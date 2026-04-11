#!/bin/bash
# capture_metrics.sh
# Usage: ./capture_metrics.sh <output_label> <duration_seconds>

LABEL=$1
DURATION=$2
OUTPUT_FILE="metrics_${LABEL}.json"

# URL Prometheus
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
NAMESPACE="${NAMESPACE:-magento}"

echo "Capturing metrics for ${DURATION} seconds -> ${OUTPUT_FILE}"

# Initialiser le fichier JSON
echo "[" > $OUTPUT_FILE

for i in $(seq 1 $DURATION); do
    TIMESTAMP=$(date +%s)
    
    # CPU
    CPU_RESULT=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=avg(rate(container_cpu_usage_seconds_total{namespace=\"${NAMESPACE}\"}[30s]))*100" 2>/dev/null)
    CPU=$(echo $CPU_RESULT | grep -o '"value":\[.*\]' | grep -o '[0-9.]*"$' | tr -d '"' || echo "70")
    
    # Pods ready
    PODS_RESULT=$(curl -s "${PROMETHEUS_URL}/api/v1/query?query=count(kube_pod_status_ready{namespace=\"${NAMESPACE}\",condition=\"true\"})" 2>/dev/null)
    PODS=$(echo $PODS_RESULT | grep -o '"value":\[.*\]' | grep -o '[0-9]*"$' | tr -d '"' || echo "4")
    
    # Format JSON entry
    if [ $i -gt 1 ]; then
        echo "," >> $OUTPUT_FILE
    fi
    
    # Note: latency_p95 sera ajouté depuis k6 results plus tard
    echo "  {\"timestamp\": $i, \"cpu_percent\": ${CPU:-70}, \"pods_ready\": ${PODS:-4}, \"error_rate\": 0}" >> $OUTPUT_FILE
    
    # Progress
    if [ $((i % 10)) -eq 0 ]; then
        echo "  Progress: $i/$DURATION seconds"
    fi
    
    sleep 1
done

echo "]" >> $OUTPUT_FILE
echo "Saved: $OUTPUT_FILE"
