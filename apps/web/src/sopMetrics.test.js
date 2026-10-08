import {it,expect} from "vitest";
import {sopMetrics} from "./sopMetrics";
it("separates daily completion from AI share of verified items",()=>{
 const tasks=[{id:"a",status:"completed",totalItems:2},{id:"b",status:"pending",totalItems:6},{id:"c",status:"pending",totalItems:6},{id:"d",status:"pending",totalItems:15}];
 const records=[{taskId:"a",result:"pass",aiVerified:true},{taskId:"a",result:"pass"},{taskId:"b",result:"review",aiVerified:true},{taskId:"other",result:"fail"}];
 expect(sopMetrics(tasks,records)).toMatchObject({completionRate:25,aiShare:50,issues:0,checked:2,unverified:27,review:1,totalItems:29});
});
it("does not imply zero pass or AI quality on empty data",()=>{expect(sopMetrics([],[])).toMatchObject({completionRate:null,aiShare:null});expect(sopMetrics([{id:"a",totalItems:2}],[])).toMatchObject({completionRate:0,aiShare:null,unverified:2});});
