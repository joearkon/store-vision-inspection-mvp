export function eligibleFeishuEvents(events, tab) {
  if (tab === "p0") {
    return events.filter((event) => event.severity === "P0" && ["E1", "B1"].includes(event.rule_code));
  }
  if (tab === "p1") {
    return events.filter((event) => event.rule_code === "E1" && event.severity === "P1");
  }
  if (tab === "p2") return events.filter((event) => event.severity === "P2" && ["A1", "G2", "M1"].includes(event.rule_code));
  return [];
}
