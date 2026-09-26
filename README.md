# Runtime-Aware Deployment Gate for Kubernetes

Experimental artifacts for the paper *"Runtime-Aware Deployment Gates for Cloud-Native Applications: Preventing Service Degradation in Kubernetes Environments"*.

## What this is about

Deploying to Kubernetes while the Horizontal Pod Autoscaler (HPA) is saturated can cause error rates above 90% for applications with slow startup times. This repository contains everything needed to reproduce our experiments and the deployment gate that prevents this.

## Repository structure

```
├── manifests/               # Kubernetes resource definitions
│   ├── magento.yaml         # Magento deployment
│   ├── mariadb.yaml         # MariaDB for Magento
│   ├── magento-hpa.yaml     # HPA configuration
│   ├── magento-ingress.yaml # Ingress rules
│   ├── magento-service.yaml # Service definition
│   └── magento-pvc.yml      # Persistent volume claim
├── docker/
│   ├── Dockerfile           # Magento container image
│   └── Dockerfile.jenkins   # Jenkins with kubectl
├── pipeline/
│   ├── Jenkinsfile          # CI/CD pipeline with adaptive gate
├── loadtest/
│   ├── high-traffic.js      # k6 script – high load scenarios
│   └── low-traffic.js       # k6 script – baseline scenarios
├── analysis/
│   ├── analyze_results.py   # Process experimental data
│   └── capture_metrics.py   # Pull metrics from Prometheus
├── experiments/
│   ├── run_vulnerability_experiment.sh
│   └── sample-data/         # Representative CSV outputs
└── LICENSE
```

## Prerequisites

- A Kubernetes cluster (we used DigitalOcean DOKS, 3 nodes, s-4vcpu-8gb)
- Kubernetes 1.28+
- Prometheus + Grafana (kube-prometheus-stack)
- Nginx Ingress Controller
- [k6](https://k6.io/) for load testing
- Jenkins (for pipeline scenarios) or any CI/CD tool
- Docker for building images

## Quick start

### 1. Deploy the application

```bash
kubectl create namespace magento
kubectl apply -f manifests/mariadb.yaml -n magento
kubectl apply -f manifests/magento-pvc.yml -n magento
kubectl apply -f manifests/magento.yaml -n magento
kubectl apply -f manifests/magento-service.yaml -n magento
kubectl apply -f manifests/magento-ingress.yaml -n magento
kubectl apply -f manifests/magento-hpa.yaml -n magento
```

### 2. Run load tests

```bash
# Baseline – high traffic, no deployment
k6 run loadtest/high-traffic.js

# Trigger a deployment during load (separate terminal)
kubectl rollout restart deployment magento -n magento
```

### 3. Use the deployment gate

The gate queries three Prometheus metrics before allowing a deployment:

| Metric | Threshold | Prometheus query |
|--------|-----------|-----------------|
| CPU utilization | > 70% | `sum(rate(container_cpu_usage_seconds_total{namespace="magento",container!=""}[2m]))` |
| Error rate | > 2% | `sum(rate(nginx_ingress_controller_requests{status!~"2.."}[2m])) / sum(rate(nginx_ingress_controller_requests[2m]))` |
| HPA saturation | > 90% | `kube_horizontalpodautoscaler_status_current_replicas{...} / kube_horizontalpodautoscaler_spec_max_replicas{...}` |

If any metric exceeds its threshold, the deployment is blocked.

Standalone usage:

```bash
# Set your Prometheus URL
export PROMETHEUS_URL=http://localhost:9090

# Run the gate check
The gate runs as a stage in the Jenkins pipeline. See `pipeline/Jenkinsfile` for the full implementation. The relevant stage queries Prometheus, evaluates the three metrics, and either proceeds to deployment or fails the build:
```

## Reproducing the paper's scenarios

| Scenario | HPA max | Deploy | Gate | Expected |
|----------|---------|--------|------|----------|
| S1 | 6 | No | – | Stable |
| S2 | 6 | Yes (surge=1) | – | Stable |
| S3 | 6 | No | – | Stable |
| S4 | 3 | No | – | Stable (saturated) |
| S5 | 3 | Yes (surge=0) | – | ~92% errors |
| S6 | 3 | Yes (surge=1) | – | ~93% errors |
| S7 (Nginx) | 3 | No | – | Stable |
| S8 (Nginx) | 3 | Yes (surge=1) | – | Stable |
| S9a | 10 | Blocked | Active | 0% errors |
| S9b | 10 | Allowed | Active | 0% errors |

To reproduce S5 (the critical scenario):

```bash
# Set HPA to maxReplicas=3
kubectl patch hpa magento-hpa -n magento -p '{"spec":{"maxReplicas":3}}'

# Start load test
k6 run loadtest/high-traffic.js &

# Wait for HPA saturation (watch until 3/3)
kubectl get hpa -n magento -w

# Trigger deployment
kubectl rollout restart deployment magento -n magento
```

## Key results

- **Without gate:** 92–93% request failure rate when deploying under HPA saturation (Magento)
- **With gate:** 0% errors – gate blocks the deployment until conditions improve
- **Fast-starting apps (Nginx):** <0.1% errors even without the gate, because the ~2s startup time is too short for queues to build up

```

## License

MIT
