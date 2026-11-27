// Remove embedded camera metadata (EXIF, GPS, XMP, comments and text chunks)
// before anything can appear in the public gallery. Reject unsupported formats.
export function sniffPhotoType(b) {
 if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return "image/jpeg";
 if(b.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>b[i]===n))return "image/png";
 if(b.length>=12&&String.fromCharCode(...b.slice(0,4))==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WEBP")return "image/webp";
 return null;
}
const concat=parts=>{const n=parts.reduce((x,p)=>x+p.length,0),o=new Uint8Array(n);let off=0;for(const p of parts){o.set(p,off);off+=p.length}return o};
const word=b=>String.fromCharCode(...b);
export function stripPhotoMetadata(input,mime){
 const b=input instanceof Uint8Array?input:new Uint8Array(input);
 if(sniffPhotoType(b)!==mime)throw Error("Image signature mismatch");
 if(mime==="image/jpeg"){
  const chunks=[b.slice(0,2)];let i=2;
  while(i<b.length){
   if(b[i]!==255)throw Error("Malformed JPEG segment");
   const marker=b[i+1];
   if(marker===0xda){chunks.push(b.slice(i));return concat(chunks)}
   if(marker===0xd9){chunks.push(b.slice(i,i+2));return concat(chunks)}
   if(marker===0x00||marker===0xff){i++;continue}
   if(i+4>b.length)throw Error("Truncated JPEG");
   const size=(b[i+2]<<8)|b[i+3];
   if(size<2||i+2+size>b.length)throw Error("Invalid JPEG length");
   // APP1 EXIF/XMP, APP13 IPTC, COM comments, and other APP metadata.
   if(!((marker>=0xe1&&marker<=0xef)||marker===0xfe))chunks.push(b.slice(i,i+size+2));
   i+=size+2;
  }
  throw Error("Missing JPEG image scan");
 }
 if(mime==="image/png"){
  const chunks=[b.slice(0,8)];let i=8,ended=false;
  const blocked=new Set(["tEXt","iTXt","zTXt","eXIf","tIME"]);
  while(i+12<=b.length){
   const size=((b[i]*2**24)+(b[i+1]<<16)+(b[i+2]<<8)+b[i+3])>>>0;
   const end=i+12+size;if(end>b.length)throw Error("Invalid PNG chunk");
   const kind=word(b.slice(i+4,i+8));
   if(!blocked.has(kind))chunks.push(b.slice(i,end));
   i=end;if(kind==="IEND"){ended=true;break}
  }
  if(!ended||i!==b.length)throw Error("PNG image is incomplete");
  return concat(chunks);
 }
 if(mime==="image/webp"){
  let i=12;const chunks=[];
  while(i+8<=b.length){
   const name=word(b.slice(i,i+4));
   const size=(b[i+4]|(b[i+5]<<8)|(b[i+6]<<16)|(b[i+7]<<24))>>>0;
   const end=i+8+size+(size%2);
   if(end>b.length)throw Error("Invalid WebP chunk");
   if(name!=="EXIF"&&name!=="XMP "){
    const p=b.slice(i,end);
    if(name==="VP8X"&&p.length>=9)p[8]&=~(0x08|0x04);
    chunks.push(p);
   }
   i=end;
  }
  if(i!==b.length)throw Error("Invalid WebP structure");
  const payload=concat(chunks),total=4+payload.length,out=new Uint8Array(12+payload.length);
  out.set(b.slice(0,12));out[4]=total&255;out[5]=(total>>>8)&255;out[6]=(total>>>16)&255;out[7]=(total>>>24)&255;
  out.set(payload,12);return out;
 }
 throw Error("Unsupported photo format");
}
