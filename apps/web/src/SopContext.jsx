import React, {createContext, useContext} from 'react';
import {isShowcaseMode} from './showcaseApi';
export const SopContext = createContext(null);
export const useSop = () => useContext(SopContext);
export function Card({children,padding='0px',style}) {return <section className="surface" style={{padding,...style}}>{children}</section>;}
export function Button({children,variant='secondary',...props}) {return <button className={`button ${variant}`} {...props} disabled={props.disabled || (isShowcaseMode && /新建|编辑|删除|保存/.test(String(children)))}>{children}</button>;}
