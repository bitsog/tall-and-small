import {test} from "node:test";
import assert from "node:assert/strict";
import {parseSimpleReplyCommand as parse} from "../supabase/functions/review-sms/simple-sms-protocol.js";
test("normal reply contains no technical review code",()=>{
 assert.deepEqual(parse("Thank you, Michael! It was a pleasure working with you."),{type:"draft",content:"Thank you, Michael! It was a pleasure working with you."});
});
test("confirm and cancellation require explicit words",()=>{
 assert.deepEqual(parse(" yes "),{type:"confirm"});
 assert.deepEqual(parse("NO"),{type:"cancel"});
 assert.deepEqual(parse("Yes, thanks!"),{type:"draft",content:"Yes, thanks!"});
});
test("opt-out and old command strings never post as natural replies",()=>{
 assert.equal(parse("STOP").type,"reserved");
 assert.equal(parse("START").type,"reserved");
 assert.equal(parse("HELP").type,"status");
 assert.equal(parse("REPLY a1b2c3d4e5 thanks").type,"invalid");
 assert.equal(parse("YES a1b2c3d4e5").type,"invalid");
 assert.equal(parse(" ").type,"invalid");
 assert.equal(parse("x".repeat(1001)).type,"invalid");
});
