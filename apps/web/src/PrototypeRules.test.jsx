import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import Page,{RuleDetailDrawer} from './PrototypeRules';
const rule={id:'NEW',name:'新规则',type:'image',typeLabel:'状态检查',severity:'P2',severityLabel:'一般',status:'draft',statusLabel:'草稿',category:'未分类',version:'草稿',updatedAt:'—',params:{inputType:'image'},notifications:[],observationSteps:[]};
const draw=tab=>renderToStaticMarkup(<RuleDetailDrawer rule={rule} activeTab={tab} severityStyle={{}} statusStyle={{}} typeColor="#059669" canAdmin disabled={false}/>);
describe('prototype rules page',()=>{
 it('renders the prototype header and creation entry',()=>{const html=renderToStaticMarkup(<Page disabled canAdmin/>);expect(html).toContain('AI 视觉巡检规则配置');expect(html).toContain('新建规则');expect(html).toContain('规则总数');});
 it('renders new-rule configuration and all four tabs without browser globals',()=>{const html=draw('config');for(const label of ['规则配置','AI 观察步骤','样本测试','版本历史','状态检查','持续时间','多事件关联','通过标准','保存草稿','提交样本测试']) {if(label==='通过标准')continue;expect(html).toContain(label);}expect(html).toContain('图片检查项');expect(html).toContain('标准参考图（可选）');expect(html).toContain('reference-upload-card');expect(html.indexOf('检测参数 · 状态检查')).toBeLessThan(html.indexOf('标准参考图（可选）')); expect(html).toContain('prototype-rule-button--sm');expect(html).toContain('prototype-rule-dialog');expect(html).not.toContain('size="sm"');});
 it('renders empty samples and version history safely',()=>{expect(draw('test')).toContain('暂无已保存');expect(draw('version')).toContain('版本');});
});
