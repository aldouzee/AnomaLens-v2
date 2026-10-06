"""Generate a synthetic stand-in dataset (~8% anomalies) so the pipeline and app run end-to-end
before the real Kaggle data is downloaded. Output: data/raw/synthetic.csv.
Metrics from this data are NOT meaningful; replace it with the real dataset."""
import numpy as np
import pandas as pd

import config


def main(n=1000, rate=0.083, seed=config.SEED):
    rng = np.random.default_rng(seed)
    y = rng.random(n) < rate
    k = int(y.sum())
    m = n - k

    def block(count, thr, cong, loss, lat, jit):
        return pd.DataFrame({
            "throughput": rng.normal(*thr, count).clip(1),
            "congestion": rng.normal(*cong, count).clip(0, 1),
            "packet_loss": rng.normal(*loss, count).clip(0),
            "latency": rng.normal(*lat, count).clip(1),
            "jitter": rng.normal(*jit, count).clip(0),
        })

    normal = block(m, (500, 60), (0.3, 0.12), (0.5, 0.4), (40, 12), (4, 2)).assign(anomaly=0)
    anom = block(k, (380, 130), (0.65, 0.2), (3.5, 2.0), (95, 35), (12, 6)).assign(anomaly=1)
    df = pd.concat([normal, anom]).sample(frac=1, random_state=seed).reset_index(drop=True).round(3)
    config.RAW_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(config.RAW_DIR / "synthetic.csv", index=False)
    print(f"wrote {len(df)} rows ({k} anomalies) to data/raw/synthetic.csv")


if __name__ == "__main__":
    main()
