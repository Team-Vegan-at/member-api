# member-api

![CodeQL](https://github.com/Team-Vegan-at/member-api/workflows/CodeQL/badge.svg?branch=main)
![Docker Build Latest](https://github.com/Team-Vegan-at/member-api/workflows/Docker%20Build%20Latest/badge.svg?branch=main)
![Docker Build Nightly](https://github.com/Team-Vegan-at/member-api/workflows/Docker%20Build%20Nightly/badge.svg?branch=develop)

[![](https://images.microbadger.com/badges/version/teamveganat/member-api:nightly.svg)](https://microbadger.com/images/teamveganat/member-api:nightly 'Get your own version badge on microbadger.com')
[![](https://images.microbadger.com/badges/image/teamveganat/member-api:nightly.svg)](https://microbadger.com/images/teamveganat/member-api:nightly 'Get your own image badge on microbadger.com')

[![](https://images.microbadger.com/badges/version/teamveganat/member-api.svg)](https://microbadger.com/images/teamveganat/member-api 'Get your own version badge on microbadger.com')
[![](https://images.microbadger.com/badges/image/teamveganat/member-api.svg)](https://microbadger.com/images/teamveganat/member-api 'Get your own image badge on microbadger.com')

![Docker Build Nightly](https://github.com/Team-Vegan-at/member-api/workflows/Docker%20Build%20Nightly/badge.svg)

## Local dev

```
docker run --rm -d -v redisjson:/data -p 6379:6379 --name redis-redisjson redislabs/rejson:latest
docker run --rm -d -v redisinsight:/db -p 8001:8001 --name redis-redisinsights redislabs/redisinsight
```
