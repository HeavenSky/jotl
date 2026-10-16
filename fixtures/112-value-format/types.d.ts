// 由 Jotl 生成, 不要手改.

export interface Schedule {
  /**
   * @format date
   */
  day: string;
  /**
   * @valueFormat YYYYMMDD
   * @widget date
   */
  dayCompact?: string;
  /**
   * @asType integer
   * @valueFormat x
   * @widget date
   */
  dayStamp?: number;
  /**
   * @valueFormat HH:mm:ss
   * @widget time
   */
  alarm?: string;
  /**
   * @defaultValue "09:00"
   * @valueFormat HH:mm
   * @widget time
   */
  alarmShort?: string;
  /**
   * @format date-time
   */
  at?: string;
  /**
   * @format date-time
   * @valueFormat iso-x
   */
  atIsoMs?: string;
  /**
   * @format date-time
   * @valueFormat utc
   */
  atUtc?: string;
  /**
   * @format date-time
   * @valueFormat utc-x
   */
  atUtcMs?: string;
  /**
   * @asType integer
   * @valueFormat x
   * @widget datetime
   */
  atMs?: number;
  /**
   * @asType integer
   * @valueFormat X
   * @widget datetime
   */
  atSec?: number;
  /**
   * @valueFormat YYYY-MM-DD HH:mm:ss
   * @widget datetime
   */
  atText?: string;
}

export default Schedule;
