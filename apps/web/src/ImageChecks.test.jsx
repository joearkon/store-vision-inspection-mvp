import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import ImageChecks from './ImageChecks';
describe('image checks deployment boundary',()=>{it('does not offer paid analysis on showcase',()=>{const html=renderToStaticMarkup(<ImageChecks disabled canAdmin/>);expect(html).toContain('暂不开放');expect(html).not.toContain('开始 AI 核验');});});
