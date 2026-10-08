import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,it,expect} from "vitest";
import {TableLayoutPanel,readTableLayout} from "./TableLayoutPanel";
describe("saved table layout",()=>{
 it("ignores missing or invalid configuration",()=>{expect(readTableLayout({roi_json:"broken"})).toBeNull();expect(renderToStaticMarkup(<TableLayoutPanel camera={{id:"empty"}}/>)).toBe("");});
 it("shows screenshot and configured but inactive tables",()=>{const camera={id:"REAL",roi_json:JSON.stringify({table_layout:{active_table_id:"T01",tables:[{id:"T01",name:"左侧"},{id:"T02",name:"前方"},{id:"T03",name:"右侧"}]}})};const html=renderToStaticMarkup(<TableLayoutPanel camera={camera}/>);expect(html).toContain("T03");expect(html).toContain("未启用");expect(html).toContain("/api/cameras/REAL/table-layout/image");});
});
