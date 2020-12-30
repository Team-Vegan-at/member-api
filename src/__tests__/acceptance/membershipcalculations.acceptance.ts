import {expect} from '@loopback/testlab';
import moment from 'moment';
import {CalcUtil} from '../../utils/calc.util';

describe('MembershipYearCalculations', () => {

  before('setupApplication', async () => {
  });

  after(async () => {
  });

  it('CalcUtil.isInMembershipRange', async () => {

    expect(CalcUtil.isInMembershipRange("2020-06-20", 2020)).to.be.true();
    expect(CalcUtil.isInMembershipRange("2019-12-02", 2020)).to.be.true();
    expect(CalcUtil.isInMembershipRange("2019-11-28", 2020)).to.be.false();
    expect(CalcUtil.isInMembershipRange("2020-12-05", 2020)).to.be.true();
    expect(CalcUtil.isInMembershipRange("2021-01-15", 2020)).to.be.true();
    expect(CalcUtil.isInMembershipRange("2021-02-02", 2020)).to.be.false();
  });

  it('CalcUtil.getExpirationDate', async () => {
    const feb2020 = moment("2020-01-31", "YYYY-MM-DD").endOf("month").toString();
    const feb2021 = moment("2021-01-31", "YYYY-MM-DD").endOf("month").toString();
    const feb2022 = moment("2022-01-31", "YYYY-MM-DD").endOf("month").toString();

    expect(CalcUtil.getExpirationDate("2019-11-20").toString()).be.exactly(feb2020);
    expect(CalcUtil.getExpirationDate("2019-12-02").toString()).be.exactly(feb2021);
    expect(CalcUtil.getExpirationDate("2020-06-20").toString()).be.exactly(feb2021);
    expect(CalcUtil.getExpirationDate("2020-12-15").toString()).be.exactly(feb2022);
    expect(CalcUtil.getExpirationDate("2021-03-04").toString()).be.exactly(feb2022);
  });

});
