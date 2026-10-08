import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect} from 'vitest';
import AgentPage from './AgentPage';
import {Sidebar} from './App';
it('renders approved assistant shell safely',()=>{const html=renderToStaticMarkup(<AgentPage disabled/>);expect(html).toContain('你好，我是小巡');expect(html).toContain('新对话');expect(html).not.toContain('6 家门店');expect(html).not.toContain('实时监控');});
it('renders reference sidebar grouping and order',()=>{const html=renderToStaticMarkup(<Sidebar route={{page:'agent',navigate:()=>{}}}/>);for(const label of ['分析任务','摄像头管理','规则配置','SOP 巡检','智能助手'])expect(html).toContain(label);expect(html.indexOf('整改工单')).toBeLessThan(html.indexOf('规则配置'));expect(html).not.toContain('门店配置');expect(html.indexOf('SOP 模板配置')).toBeLessThan(html.indexOf('智能助手'));});
