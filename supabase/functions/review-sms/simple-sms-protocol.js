// Parse David's natural-language review replies without asking for review codes.
export function parseSimpleReplyCommand(input) {
 const text=String(input||"").trim();
 const upper=text.toUpperCase();
 if(upper==="YES")return {type:"confirm"};
 if(upper==="NO")return {type:"cancel"};
 if(upper==="HELP"||upper==="STATUS")return {type:"status"};
 if(["STOP","STOPALL","UNSUBSCRIBE","CANCEL","END","QUIT","START","UNSTOP"].includes(upper))return {type:"reserved"};
 if(!text||text.length>1000||/^(?:REPLY|YES)\s+[0-9a-f]{10}(?:\s|$)/i.test(text))return {type:"invalid"};
 return {type:"draft",content:text};
}
