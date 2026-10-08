import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {it,expect} from "vitest";
import {EventDetail} from "./App";
it("event loading render cannot reference analysis run state",()=>{expect(()=>renderToStaticMarkup(<EventDetail id="EVT" navigate={()=>{}} canEdit={false}/>)).not.toThrow();expect(renderToStaticMarkup(<EventDetail id="EVT" navigate={()=>{}} canEdit={false}/>)).toContain("正在加载事件证据");});
