"""Select later recorded observations without rewriting an event verdict."""

def table_followup_findings(rows, confirmed_offset):
    later = [row for row in rows if row["captured_offset"] > confirmed_offset]
    if not later:
        return []
    selected = later[:3]
    # Prefer three adjacent observations where the sampling window provides them.
    for index in range(len(later) - 2):
        group = later[index:index + 3]
        if all(0 < group[i+1]["captured_offset"] - group[i]["captured_offset"] <= 1.5 for i in range(2)):
            selected = group
            break
    result = [(f"followup_{i+1}", row) for i, row in enumerate(selected)]
    if later[-1]["id"] not in {row["id"] for row in selected}:
        result.append(("video_end", later[-1]))
    return result
