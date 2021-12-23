import moment, {Moment} from 'moment';

export class CalcUtil {
  private static debug = require('debug')('api:CalcUtil');

  public static isInMembershipRange(shortDate: string, year: number): boolean {

    let monthsOfPreviousYear = 2;

    // Exception case 2022: Sportfoerderung for all new members from 01. September
    if (year === 2022) {
      monthsOfPreviousYear = 4;
    }


    const from =  moment(year, "YYYY")
                  .startOf("year")
                  .subtract(monthsOfPreviousYear, 'month') // first of november
                  .startOf("month");
    const to =    moment(year, "YYYY")
                  .endOf("year")
                  .add(1, 'month')      // end of january
                  .endOf("month");

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
