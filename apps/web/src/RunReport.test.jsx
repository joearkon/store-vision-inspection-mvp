import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect} from 'vitest';
import {RunReport,reportMoney} from './RunReport';
it('shows real zero-event observations and does not fabricate screenshots',()=>{
 const html=renderToStaticMarkup(<RunReport run={{report:{explanation:'未确认',observed_frame_count:1,frames:[{id:'F',captured_offset:12,visual_state:'clean',confidence:.9,evidence:'桌面为空',image_url:'/api/media/findings/F'}]}}}/>);
 expect(html).toContain('12 秒');expect(html).toContain('桌面为空');expect(html).toContain('/api/media/findings/F');
 const empty=renderToStaticMarkup(<RunReport run={{report:{frames:[],observed_frame_count:0,explanation:'无帧'}}}/>);
 expect(empty).toContain('尚无逐帧');expect(empty).not.toContain('<img');
 expect(reportMoney(.232296)).toBe('约 ¥0.2323');expect(reportMoney(null)).toContain('未完整');
});
