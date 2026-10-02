/**
 * Admin data can briefly be served across deployments with different response
 * shapes. Missing measurements should leave a blank metric, not crash a panel.
 * @param {unknown} value
 * @param {Intl.NumberFormatOptions} [options]
 */
export function formatAdminNumber(value, options) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-US", options)
    : "—";
}
