const json=(data,status=200,headers={})=>Response.json(data,{status,headers});
const COOKIE="pph_session";
const enc=new TextEncoder();

function b64url(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
async function hmac(secret,value){const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return b64url(await crypto.subtle.sign("HMAC",key,enc.encode(value)))}
async function makeSession(env){const payload=`${Date.now()}.${crypto.randomUUID()}`;return `${payload}.${await hmac(env.SESSION_SECRET,payload)}`}
async function isAdmin(req,env){const cookie=req.headers.get("Cookie")||"";const value=cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="))?.slice(COOKIE.length+1);if(!value)return false;const parts=value.split(".");if(parts.length!==3)return false;const payload=parts.slice(0,2).join(".");const sig=parts[2];if(Date.now()-Number(parts[0])>86400000)return false;return sig===await hmac(env.SESSION_SECRET,payload)}
function sameOrigin(req){const origin=req.headers.get("Origin");return !origin||origin===new URL(req.url).origin}
function clean(body){const status=["draft","published","sold","hidden"].includes(body.status)?body.status:"draft";return {title:String(body.title||"").trim().slice(0,250),type:String(body.type||"อื่นๆ").slice(0,60),location:String(body.location||"").slice(0,200),price:Math.max(0,Number(body.price)||0),description:String(body.description||"").slice(0,20000),source_url:String(body.source_url||"").trim().slice(0,1000),status,image_source:String(body.image_source||"").slice(0,1000),images:Array.isArray(body.images)?body.images.filter(x=>typeof x==="string"&&x.startsWith("/media/")).slice(0,20):[]}}
function valid(x){return !!x.title&&(!x.source_url||/^https:\/\/(www\.|m\.)?facebook\.com\//i.test(x.source_url))}
async function listProperties(env,admin){const q=admin?"SELECT * FROM properties ORDER BY id DESC":"SELECT * FROM properties WHERE status='published' ORDER BY id DESC";const {results}=await env.DB.prepare(q).all();return results.map(x=>({...x,images:JSON.parse(x.images||"[]")}))}
function cookie(value,maxAge=86400){return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`}
async function requireAdmin(req,env){if(!(await isAdmin(req,env)))return json({error:"Unauthorized"},401);if(!sameOrigin(req))return json({error:"Invalid origin"},403);return null}

export default {
  async fetch(req,env){
    const url=new URL(req.url);
    try{
      if(!url.pathname.startsWith("/api/")&&!url.pathname.startsWith("/media/"))return env.ASSETS.fetch(req);

      if(url.pathname.startsWith("/media/")){
        const key=decodeURIComponent(url.pathname.slice(7));
        if(!key||key.includes(".."))return new Response("Not found",{status:404});
        const obj=await env.IMAGES.get(key);
        if(!obj)return new Response("Not found",{status:404});
        const headers=new Headers();
        obj.writeHttpMetadata(headers);
        headers.set("etag",obj.httpEtag);
        headers.set("Cache-Control","public, max-age=31536000, immutable");
        return new Response(obj.body,{headers});
      }

      if(url.pathname==="/api/session"&&req.method==="GET")return json({admin:await isAdmin(req,env)});
      if(url.pathname==="/api/properties"&&req.method==="GET")return json(await listProperties(env,await isAdmin(req,env)));

      if(url.pathname==="/api/login"&&req.method==="POST"){
        if(!sameOrigin(req))return json({error:"Invalid origin"},403);
        const body=await req.json();
        const okUser=String(body.username||"")===(env.ADMIN_USER||"owner");
        const a=enc.encode(String(body.password||"")),b=enc.encode(String(env.ADMIN_PASSWORD||""));
        let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a[i%a.length]||0)^(b[i%b.length]||0);
        if(!okUser||diff!==0)return json({error:"Invalid credentials"},401);
        return json({ok:true},200,{"Set-Cookie":cookie(await makeSession(env))});
      }
      if(url.pathname==="/api/logout"&&req.method==="POST"){
        if(!sameOrigin(req))return json({error:"Invalid origin"},403);
        return json({ok:true},200,{"Set-Cookie":cookie("",0)});
      }

      if(url.pathname==="/api/upload"&&req.method==="POST"){
        const denied=await requireAdmin(req,env);if(denied)return denied;
        const form=await req.formData();const files=form.getAll("images");const urls=[];
        if(files.length>12)return json({error:"Too many files"},400);
        for(const file of files){
          if(!(file instanceof File))continue;
          if(file.size>8*1024*1024)return json({error:"File too large"},400);
          if(!["image/jpeg","image/png","image/webp"].includes(file.type))return json({error:"Unsupported image type"},400);
          const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];
          const key=`properties/${crypto.randomUUID()}.${ext}`;
          await env.IMAGES.put(key,file.stream(),{httpMetadata:{contentType:file.type}});
          urls.push("/media/"+encodeURIComponent(key));
        }
        return json({urls});
      }

      if(url.pathname==="/api/properties"&&req.method==="POST"){
        const denied=await requireAdmin(req,env);if(denied)return denied;
        const x=clean(await req.json());if(!valid(x))return json({error:"Title or Facebook URL invalid"},400);
        try{
          const r=await env.DB.prepare("INSERT INTO properties(title,type,location,price,description,source_url,status,images,image_source) VALUES(?,?,?,?,?,?,?,?,?)")
          .bind(x.title,x.type,x.location,x.price,x.description,x.source_url||null,x.status,JSON.stringify(x.images),x.image_source).run();
          return json({id:r.meta.last_row_id});
        }catch(e){return json({error:String(e).includes("UNIQUE")?"Duplicate source URL":"Database error"},409)}
      }

      const m=url.pathname.match(/^\/api\/properties\/(\d+)$/);
      if(m&&req.method==="PUT"){
        const denied=await requireAdmin(req,env);if(denied)return denied;
        const x=clean(await req.json());if(!valid(x))return json({error:"Invalid input"},400);
        try{
          await env.DB.prepare("UPDATE properties SET title=?,type=?,location=?,price=?,description=?,source_url=?,status=?,images=?,image_source=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
          .bind(x.title,x.type,x.location,x.price,x.description,x.source_url||null,x.status,JSON.stringify(x.images),x.image_source,Number(m[1])).run();
          return json({ok:true});
        }catch(e){return json({error:String(e).includes("UNIQUE")?"Duplicate source URL":"Database error"},409)}
      }
      if(m&&req.method==="DELETE"){
        const denied=await requireAdmin(req,env);if(denied)return denied;
        const row=await env.DB.prepare("SELECT images FROM properties WHERE id=?").bind(Number(m[1])).first();
        await env.DB.prepare("DELETE FROM properties WHERE id=?").bind(Number(m[1])).run();
        for(const path of JSON.parse(row?.images||"[]"))if(path.startsWith("/media/"))await env.IMAGES.delete(decodeURIComponent(path.slice(7)));
        return json({ok:true});
      }
      return json({error:"Not found"},404);
    }catch(e){return json({error:"Server error"},500)}
  }
};