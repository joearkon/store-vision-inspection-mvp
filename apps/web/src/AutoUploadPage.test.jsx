import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,it,expect} from "vitest";
import {ScenePreview,AutoUploadPage,uploadRuleScope} from "./AutoUploadPage";
describe("automatic upload",()=>{
 it("defaults to new source instead of storage and removes manual area selection",()=>{
  const html=renderToStaticMarkup(<AutoUploadPage bootstrap={{store:{name:"门店"},cameras:[]}} navigate={()=>{}}/>);
  expect(html).toContain("未知 / 新机位");expect(html).not.toContain("关联视频区域");expect(html).not.toContain("CAM-STORAGE-01");
  expect(html).toMatch(/type="checkbox"[^>]*checked=""/);expect(html).toContain('飞书通知默认开启');
 });
 it("renders actual normalized coordinates and confidence indication",()=>{
  const html=renderToStaticMarkup(<ScenePreview result={{preview_url:"/api/videos/V/scene/image",regions:[{kind:"table",confidence:.6,bbox:[.1,.2,.4,.5]}]}}/>);
  expect(html).toContain('x="100"');expect(html).toContain('width="300');expect(html).toContain('#ea580c');expect(html).toContain('餐桌');
 });
});

it("limits dispatch to the selected severity without changing rule severity",()=>{
 expect(uploadRuleScope(["E1","B1","A1","A2"],"P0")).toEqual(["E1","B1"]);
 expect(uploadRuleScope(["E1","A1","A2"],"P1")).toEqual(["A2"]);
 expect(uploadRuleScope(["E1","A1"],"all")).toEqual(["E1","A1"]);
 expect(uploadRuleScope(["A1"],"P0")).toEqual([]);
});

it("uses collapsible camera cards and AI wording",()=>{
 const html=renderToStaticMarkup(<AutoUploadPage bootstrap={{store:{name:"门店"},cameras:[{id:"C1",name:"前台-01",area_type:"front_counter",status:"online",preview_image_url:"/frame.jpg"}]}} navigate={()=>{}}/>);
 expect(html).toContain("AI 识别");expect(html).not.toContain("豆包真实识别");
 expect(html).toContain("upload-camera-option");expect(html).toContain("/frame.jpg");
 expect(html).toContain("严重程度（可选）");expect(html).toContain("检测规则（可选）");expect(html).not.toContain("<details open");
});

it("does not request a recording clock and renders aligned rule cards",()=>{
 const html=renderToStaticMarkup(<AutoUploadPage bootstrap={{store:{name:"门店"},cameras:[]}} navigate={()=>{}}/>);
 expect(html).not.toContain('type="time"');expect(html).not.toContain("视频开始时间");
 expect(html).toContain("upload-rule-options");expect(html).toContain("upload-rule-code");
});
