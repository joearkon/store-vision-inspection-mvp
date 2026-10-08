from .costs import estimate_analysis_cost


def build_run_report(database, run):
    rows = database.fetch_all(
        'SELECT id,captured_offset,visual_state,confidence,evidence,image_quality FROM frame_findings WHERE run_id=? ORDER BY captured_offset',
        (run['id'],),
    )
    selected = []
    states = set()
    for row in rows:
        if row['visual_state'] not in states and len(selected) < 5:
            selected.append(row)
            states.add(row['visual_state'])
    if rows and (not selected or selected[-1]['id'] != rows[-1]['id']):
        selected.append(rows[-1])
    selected.sort(key=lambda row: row['captured_offset'])
    for row in selected:
        row['image_url'] = f"/api/media/findings/{row['id']}"
    explanation = '以下为实际模型观察截图；单帧描述可能存在误判，最终事件由时序规则聚合。'
    if run['status'] != 'completed':
        explanation = '任务尚未完成有效判定；以下仅为已保存的中间观察。'
    elif run['rule_code'] == 'G2' and not run['event_count'] and rows:
        explanation = '未形成离席后残留的确认事件。'
        if rows[-1]['visual_state'] == 'clean':
            explanation += '后段复核帧显示桌面为空，疑似候选未通过时序确认。'
        explanation += '截图保留模型原始观察，零事件不等于所有桌位均合规。'
    scene_cost = (run.get('scene_detection_usage') or {}).get('estimated_cost_yuan')
    rule_cost = run.get('estimated_cost_yuan')
    siblings = database.fetch_all('SELECT * FROM analysis_runs WHERE video_id=? ORDER BY created_at,id', (run['video_id'],))
    costs = [estimate_analysis_cost(item).get('estimated_cost_yuan') for item in siblings]
    known = all(cost is not None for cost in costs)
    scene_known = not run.get('scene_detection_usage') or scene_cost is not None
    return {
        'explanation': explanation, 'frames': selected, 'observed_frame_count': len(rows),
        'costs': {
            'rule_yuan': rule_cost, 'scene_yuan': scene_cost,
            'rule_with_scene_yuan': rule_cost + (scene_cost or 0) if rule_cost is not None and scene_known else None,
            'video_total_yuan': round(sum(costs) + (scene_cost or 0), 6) if known and scene_known else None,
            'video_task_count': len(siblings),
            'video_complete': all(item['status'] in ('completed','failed') for item in siblings),
        },
    }
