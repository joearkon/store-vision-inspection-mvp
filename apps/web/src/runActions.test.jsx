import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,it,expect} from "vitest";
import {RunActions} from "./RunActions";
import {runOutcome} from "./runResult";
describe("run task controls",()=>{
 it("shows a paused reason and both actions",()=>{const run={id:"x",status:"awaiting_approval",fallback_reason:"证据不足"};expect(runOutcome(run).detail).toBe("证据不足");const html=renderToStaticMarkup(<RunActions run={run} onUpdate={()=>{}}/>);expect(html).toContain("继续逐帧复核");expect(html).toContain("取消分析");});
 it("does not offer actions on finished records",()=>{for(const status of ["completed","failed","cancelled"])expect(renderToStaticMarkup(<RunActions run={{status}} onUpdate={()=>{}}/>)).toBe("");expect(runOutcome({status:"cancelled"}).label).toBe("已取消");});
});

import {uploadRuleScope} from "./AutoUploadPage";
it("explicit selected rules restrict analysis independently of detected candidates",()=>{
 expect(uploadRuleScope(["A1","A2","G2"],"all",["A1"])).toEqual(["A1"]);
 expect(uploadRuleScope(["A1","A2"],"P0",["E1"])).toEqual(["E1"]);
 expect(uploadRuleScope(["A1","A2"],"P1")).toEqual(["A2"]);
});
