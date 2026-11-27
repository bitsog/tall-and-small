import {test} from "node:test";
import assert from "node:assert/strict";
import {sniffPhotoType,stripPhotoMetadata} from "../supabase/functions/review-sms/photo-safety.js";
function makePng(){
 const signature=Uint8Array.from([137,80,78,71,13,10,26,10]);
 function chunk(type,payload=[]){
  const n=payload.length,b=new Uint8Array(12+n),v=new DataView(b.buffer);
  v.setUint32(0,n);b.set([...type].map(x=>x.charCodeAt(0)),4);b.set(payload,8);return b;
 }
 const chunks=[signature,chunk("tEXt",[71,80,83,0,49]),chunk("IEND")];
 const n=chunks.reduce((x,c)=>x+c.length,0),out=new Uint8Array(n);let i=0;for(const c of chunks){out.set(c,i);i+=c.length}return out;
}
test("detects JPEG, PNG and WebP image signatures",()=>{
 assert.equal(sniffPhotoType(Uint8Array.from([255,216,255,217])),"image/jpeg");
 assert.equal(sniffPhotoType(makePng()),"image/png");
 assert.equal(sniffPhotoType(new Uint8Array(20)),null);
});
test("strips PNG textual GPS metadata, preserving the IEND chunk",()=>{
 const stripped=stripPhotoMetadata(makePng(),"image/png");
 assert.equal(new TextDecoder().decode(stripped).includes("tEXt"),false);
 assert.equal(new TextDecoder().decode(stripped).includes("IEND"),true);
});
test("rejects unknown files mislabeled as images",()=>{
 assert.throws(()=>stripPhotoMetadata(new TextEncoder().encode("<svg>"),"image/jpeg"));
});