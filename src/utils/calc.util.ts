import moment, {Moment} from 'moment';

export class CalcUtil {
  private static debug = require('debug')('api:CalcUtil');

  public static isInMembershipRange(shortDate: string, year: number): boolean {

    // let subtractMonthsOfPreviousYear = 2;
    let subtractDaysOfPreviousYear = 61;
    // let subtractMonthsOfCurrentYear = 2;
    let subtractDaysOfCurrentYear = 61;

    // Exception case 2022: Sportfoerderung for all new members from 01. September
    if (year === 2021) {
      // subtractMonthsOfCurrentYear = 4;
      subtractDaysOfCurrentYear = 30 + 31 + 30 + 31; // 4 months
    } else if (year === 2022) {
      // subtractMonthsOfPreviousYear = 4;
      subtractDaysOfPreviousYear = 30 + 31 + 30 + 31; // 4 months
      subtractDaysOfCurrentYear = 44; // 18. Nov 2022
    } else if (year === 2023) {
      subtractDaysOfPreviousYear = 44; // 18. Nov 2022
    }

    const from =  moment(year, "YYYY")
                  .startOf("year")
                  .subtract(subtractDaysOfPreviousYear, 'days'); // first of november
                  // .startOf("month");
    const to =    moment(year, "YYYY")
                  .endOf("year")
                  .subtract(subtractDaysOfCurrentYear, 'days');
                  // .endOf("month");

    CalcUtil.debug(`Is ${moment(shortDate, "YYYY-MM-DD")} within ${from} and ${to}?`);

    return moment(shortDate, "YYYY-MM-DD").isBetween(from, to);
  }


  public static getExpirationDate(shortDate: string): Moment {

    const year = moment(shortDate, "YYYY-MM-DD").year();
    const month = moment(shortDate, "YYYY-MM-DD").month();
    let expirationDate: Moment;

    if (year === 2021 && month > 7) {
      // Exception case 2022: Sportfoerderung for all new members
      // from 01. September 2021 - 31. December 2021
      expirationDate =  moment(2023, 'YYYY')
                        .startOf("year")
                        .endOf('month');
    } else if (month === 11) {
      // Year before
      expirationDate =  moment(year, 'YYYY')
                        .endOf("year")
                        .add(1, 'year')
                        .add(1, 'month')
                        .endOf('month');
    } else {
      // Current Year
      expirationDate =  moment(year, 'YYYY')
                        .endOf("year")
                        .add(1, 'month')
                        .endOf('month')
    }

    CalcUtil.debug(`${moment(shortDate, "YYYY-MM-DD")} expires on ${expirationDate}`);

    return expirationDate;
  }

  public static getCurrentMembershipYear(): number {

    if (moment().utc().month() === 11) {
      return moment().utc().add(1, "year").year();
    } else {
      return moment().utc().year();
    }

  }
}
