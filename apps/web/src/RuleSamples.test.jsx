import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect} from 'vitest';
import {sampleMetrics,RuleSamples} from './RuleSamples';
it('computes accuracy only for completed binary AI decisions with labels',()=>{
 const records=[{status:'completed',conclusion:'pass',ground_truth:'pass'},{status:'completed',conclusion:'fail',ground_truth:'pass'},{status:'completed',conclusion:'review',ground_truth:'fail'},{status:'pending',ground_truth:'pass'}];
 expect(sampleMetrics(records)).toEqual({total:4,labeled:4,correct:1,comparable:2,accuracy:50});expect(sampleMetrics([]).accuracy).toBe(null);
});
it('renders prototype statistics, upload and sample list in read-only mode',()=>{const html=renderToStaticMarkup(<RuleSamples disabled readOnly rule={{id:'NEW',type:'image',params:{inputType:'image'}}}/>);for(const label of ['样本测试概况','样本总数','已标注','AI 正确','准确率','测试样本列表'])expect(html).toContain(label);expect(html).toContain('disabled');});
