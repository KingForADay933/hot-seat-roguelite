/** "" for a regulation game, " OT" for one extra period, " 2OT"/" 3OT"/... beyond that. */
export function formatOvertimeLabel(overtimePeriods: number): string {
  if (overtimePeriods <= 0) return ''
  return overtimePeriods === 1 ? ' OT' : ` ${overtimePeriods}OT`
}
