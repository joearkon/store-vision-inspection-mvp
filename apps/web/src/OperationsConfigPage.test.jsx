import {describe,it,expect} from "vitest";
import {camerasForStore} from "./OperationsConfigPage";
describe("store operation scope",()=>{
 it("keeps table layouts within the selected store",()=>{
  const cameras=[{id:"A",store_id:"S1",roi_json:"saved"},{id:"B",store_id:"S2"}];
  expect(camerasForStore(cameras,"S1").map(c=>c.id)).toEqual(["A"]);
  expect(camerasForStore(cameras,"S2").map(c=>c.id)).toEqual(["B"]);
  expect(camerasForStore(cameras,"S3")).toEqual([]);
  expect(camerasForStore(null,"S1")).toEqual([]);
 });
});
