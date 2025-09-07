
# neon1-site :: ops/logs-insights.md
# Purpose: Ready-to-run CloudWatch Logs Insights queries for Lambda and API Gateway.

## Lambda: recent errors
```
fields @timestamp, @message, level, message, requestId, sessionId, error
| filter level = "ERROR"
| sort @timestamp desc
| limit 50
```

## Lambda: latency summary (ms)
```
fields @timestamp, total_latency_ms, requestId, sessionId
| filter ispresent(total_latency_ms)
| stats avg(total_latency_ms) as avg_ms, pct(total_latency_ms, 50) as p50_ms, pct(total_latency_ms, 95) as p95_ms by bin(1h)
| sort bin(1h) desc
```

## Lambda: top warnings
```
fields @timestamp, level, message, requestId, sessionId
| filter level = "WARN"
| sort @timestamp desc
| limit 100
```

## API Gateway: 4XX/5XX
(Select the API access log group)
```
fields @timestamp, status, httpMethod, routeKey, ip, userAgent, requestId, path
| filter status >= 400
| sort @timestamp desc
| limit 100
```

## API Gateway: request volume by route
```
fields @timestamp, routeKey, status
| stats count() as requests by routeKey, bin(5m)
| sort bin(5m) desc
```
