import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {SopContext} from './SopContext';
import {SOPPage} from './SOPPage';
import {SOPTemplatePage} from './SOPTemplatePage';
import {SOPTaskPage} from './SOPTaskPage';
const data={stores:[{id:'S',name:'门店'}],templates:[],tasks:[],records:[],cameraImages:{}};
const render=component=>renderToStaticMarkup(<SopContext.Provider value={{data}}>{component}</SopContext.Provider>);
describe('SOP latest prototype integration',()=>{
 it('renders empty store task page without white screen or fabricated statistics',()=>{const html=render(<SOPPage storeId="S" onNavigate={()=>{}}/>);expect(html).toContain('主动巡检');expect(html).toContain('暂无符合条件');expect(html).not.toContain('NaN');});
 it('renders template configuration without globals',()=>{expect(render(<SOPTemplatePage onNavigate={()=>{}}/>)).toContain('SOP 模板配置');});
 it('missing task is an explicit state',()=>{expect(render(<SOPTaskPage taskId="missing" onNavigate={()=>{}}/>)).toContain('任务不存在');});
});
it('pending checklist categories never claim all passed',()=>{
 const fixture={...data,templates:[{id:'T',name:'开店检查',color:'#F59E0B'}],tasks:[{id:'TASK',templateId:'T',name:'开店检查',status:'in_progress',totalItems:2,completedItems:1}],records:[{id:1,taskId:'TASK',category:'着装',text:'口罩',result:'pending',checkedBy:'等待证据'},{id:2,taskId:'TASK',category:'清洁',text:'拖地',result:'pass',checkedBy:'AI 视频核验',aiVerified:true,issueNote:'拖地检查通过'}]};
 const html=renderToStaticMarkup(<SopContext.Provider value={{data:fixture}}><SOPTaskPage taskId="TASK" onNavigate={()=>{}}/></SopContext.Provider>);
 expect(html).toContain('已通过 0/1 项');expect(html).toContain('拖地检查通过');expect(html).not.toContain('NaN');
});
