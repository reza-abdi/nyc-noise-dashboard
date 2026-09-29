import os
import time
import glob
import pandas as pd
from importlib import reload
import utils.CD_conversion

# Reload in case utils.cd_conversion was edited
reload(utils.CD_conversion)
from utils.CD_conversion import add_community_districts


def batch_add_community_districts(
    df,
    output_path,
    batch_size=100_000,
    sleep_seconds=1,
    max_retries=3,
    resume=True,
    temp_dir="data/tmp_cd_batches"
):
    """
    Process a large DataFrame in batches using add_community_districts(), saving
    each batch as a temporary CSV for safe resumption.

    Parameters
    ----------
    df : pandas.DataFrame
        Input dataframe to process.
    output_path : str
        Final output CSV path.
    batch_size : int, default=100_000
        Number of rows per batch.
    sleep_seconds : int, default=1
        Delay between batches to avoid API overload.
    max_retries : int, default=3
        Retry attempts for failed batch.
    resume : bool, default=True
        Resume from existing temporary files if available.
    temp_dir : str, default="data/tmp_cd_batches"
        Directory for temporary batch files.

    Returns
    -------
    pd.DataFrame
        Final merged dataframe (if you have enough memory).
    """

    os.makedirs(temp_dir, exist_ok=True)
    total_rows = len(df)
    num_batches = (total_rows + batch_size - 1) // batch_size
    print(f"🔧 Total rows: {total_rows:,} → {num_batches:,} batches of {batch_size:,} rows")

    # Determine which batches already exist
    existing_batches = set()
    if resume:
        existing_batches = {
            os.path.basename(f).replace(".csv", "")
            for f in glob.glob(os.path.join(temp_dir, "batch_*.csv"))
        }
        if existing_batches:
            print(f"♻️ Found {len(existing_batches)} completed batch files; resuming...")

    # Process new batches
    for batch_idx in range(num_batches):
        batch_name = f"batch_{batch_idx:05d}"
        batch_file = os.path.join(temp_dir, f"{batch_name}.csv")

        if resume and batch_name in existing_batches:
            print(f"✅ Skipping {batch_name} (already done)")
            continue

        start = batch_idx * batch_size
        end = min(start + batch_size, total_rows)
        print(f"\n🔹 Processing {batch_name}: rows {start:,}–{end-1:,}")

        batch = df.iloc[start:end]

        # Retry loop
        for attempt in range(1, max_retries + 1):
            try:
                t0 = time.time()
                processed = add_community_districts(batch)
                elapsed = time.time() - t0
                print(f"⏱️ Batch {batch_idx+1}/{num_batches} done in {elapsed:.1f}s")
                processed.to_csv(batch_file, index=False)
                break
            except Exception as e:
                print(f"⚠️ Error on attempt {attempt}/{max_retries}: {e}")
                if attempt == max_retries:
                    print(f"❌ Failed to process {batch_name}, skipping...")
                    break
                time.sleep(3)

        del batch
        time.sleep(sleep_seconds)

    # Merge all completed batches
    print("\n🧩 Merging all batch files into final output...")
    batch_files = sorted(glob.glob(os.path.join(temp_dir, "batch_*.csv")))
    if not batch_files:
        raise RuntimeError("No batch files found — nothing to merge.")

    df_list = [pd.read_csv(f) for f in batch_files]
    df_final = pd.concat(df_list, ignore_index=True)
    df_final.to_csv(output_path, index=False)

    print(f"\n✅ All batches processed and saved to: {output_path}")
    print(f"📂 Temporary batch files remain in: {temp_dir}")

    return df_final
