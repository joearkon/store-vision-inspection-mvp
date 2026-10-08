import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {ImageUploadPage,ImageTaskList,imageProgress} from './ImageUploadPage';
import {Sidebar} from './App';
describe('image analysis entry',()=>{
 it('merges video and image navigation into one material upload entry',()=>{const html=renderToStaticMarkup(<Sidebar route={{page:'imageUpload',navigate(){}}}/>);expect(html).toContain('素材上传');expect(html).not.toContain('图片上传');expect(html).not.toContain('视频上传');expect(html.indexOf('素材上传')).toBeLessThan(html.indexOf('分析任务'));expect(html).toMatch(/class="active"[^>]*>.*?素材上传/);});
 it('requires a configured standard and prevents showcase upload',()=>{const html=renderToStaticMarkup(<ImageUploadPage disabled navigate={()=>{}}/>);expect(html).toContain('请选择图片核验规则');expect(html).toContain('线上演示暂不开放');expect(html).toContain('disabled');});
 it('lists image identification independently of video events',()=>{expect(renderToStaticMarkup(<ImageTaskList navigate={()=>{}}/>)).toContain('图片识别任务');});
 it('uses persisted check results for progress, including completed non-pass results',()=>{const task={rule:{items:[{id:'a'},{id:'b'}]},results:{a:{status:'fail'}},status:'analyzing'};expect(imageProgress(task)).toBe(50);expect(imageProgress({...task,status:'completed'})).toBe(100);});
});
