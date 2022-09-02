import process from 'process';

export class AxiosUtil {

  public static instance() {
    const axios = require('axios');

    axios.defaults.baseURL = process.env.DISCOURSE_URL;
    axios.defaults.headers.common['Api-Key'] = process.env.DISCOURSE_ADMIN_KEY;
    return axios;
  }

}
