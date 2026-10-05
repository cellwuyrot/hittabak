import path from "path";
import { realpath, stat } from "fs/promises";
export type DetectedFile = { extension: string; mime: string; active?: boolean };
export function validateSegments(segments: string[]): string {
  if(!Array.isArray(segments)||!segments.length) throw new Error("invalid path");
  for(const s of segments){ if(!s||s==="."||s===".."||s.includes("/")||s.includes("\\")||s.includes("%")||s.includes("\0")||path.isAbsolute(s)) throw new Error("invalid path"); }
  return segments.join(path.sep);
}
export async function safeExistingPath(root:string,segments:string[]):Promise<string>{
  const relative=validateSegments(segments); const realRoot=await realpath(root); const candidate=await realpath(path.join(realRoot,relative));
  if(candidate!==realRoot&&!candidate.startsWith(realRoot+path.sep))throw new Error("outside root"); const info=await stat(candidate); if(!info.isFile())throw new Error("not file"); return candidate;
}
export function detectFile(buffer:Buffer):DetectedFile|null{
  if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return{extension:".jpg",mime:"image/jpeg"};
  if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return{extension:".png",mime:"image/png"};
  if(buffer.subarray(0,6).toString()==="GIF87a"||buffer.subarray(0,6).toString()==="GIF89a")return{extension:".gif",mime:"image/gif"};
  if(buffer.subarray(0,4).toString()==="RIFF"&&buffer.subarray(8,12).toString()==="WEBP")return{extension:".webp",mime:"image/webp"};
  if(buffer.subarray(0,4).toString("hex")==="1a45dfa3")return{extension:".webm",mime:"video/webm"};
  if(buffer.length>12&&buffer.subarray(4,8).toString()==="ftyp")return{extension:".mp4",mime:"video/mp4"};
  const head=buffer.subarray(0,512).toString("utf8").trimStart(); if(/^<\?xml[\s\S]*?<svg\b/i.test(head)||/^<svg\b/i.test(head))return{extension:".svg",mime:"image/svg+xml",active:true};
  return null;
}
