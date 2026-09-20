/**
 * The mode the spinner is currently in. Controls glyph animation and shimmer.
 */
export type SpinnerMode =
  | 'requesting'
  | 'responding'
  | 'thinking'
  | 'tool-input'
  | 'tool-use'

/**
 * An RGB color with 0-255 integer channels, used by the shimmer/glimmer
 * animation to interpolate between theme colors.
 */
export type RGBColor = {
  r: number
  g: number
  b: number
}
