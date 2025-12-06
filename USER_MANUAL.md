# OPAL - OrcaSlicer Pressure Advance Lab

## User Manual & Tutorial

Welcome to OPAL! This tool helps you visualize and calibrate Pressure Advance (PA) settings for your 3D printer.

### 1. Pattern Generation & Batching

Before testing, you need to define the range of speeds and accelerations you want to test.

1.  **Configure Range**:

    - **Acceleration**: Set `Min`, `Max`, and `Steps` (e.g., 500 to 3000 in 5 steps).
    - **Speed**: Set `Min`, `Max`, and `Steps` (e.g., 40 to 200 in 5 steps).
    - The grid will automatically update to show all combinations.

2.  **Printer Settings**:

    - **Layer Height** and **Line Width** are fixed values in OPAL.
    - Enter your `Nozzle Diameter` and `Filament Flow Ratio`.
    - **Verification**: Check the **Volumetric Flow Rate** (Min/Max) displayed in OPAL against the values shown in your slicer's preview (e.g., OrcaSlicer). If they don't match, double-check your Speed, Acceleration, Nozzle, and Flow Ratio settings.

3.  **Batch Division (Max Patterns)**:
    - If your test pattern is too large to fit on a single print plate, use the **Max Patterns/Print** setting.
    - **Example**: If you want to test a 4x4 grid (16 total patterns) but your bed only fits 4 at a time:
      - Set **Max Patterns/Print** to `4`.
      - OPAL will generate 4 separate batches (Batch 1, 2, 3, 4), each containing a 2x2 grid.
    - Print each batch separately and enter the results into the corresponding "Batch" sections in the table.

### 2. Data Collection (Entering Results)

Once you have printed your test pattern (using a PA Pattern generator like Ellis's or OrcaSlicer's), measure the best PA value for each Speed/Accel combination.

1.  **Enter PA Values**:

    - Locate the corresponding cell in the table (matched by Speed and Acceleration).
    - Enter your measured PA value in the `PA1` field.
    - Reference links for how to select optimal PA values:
      - [OrcaSlicer Wiki: Adaptive Pressure Advance](https://github.com/OrcaSlicer/OrcaSlicer/wiki/adaptive-pressure-advance-calib)
      - [Ellis' Print Tuning Guide](https://ellis3dp.com/Print-Tuning-Guide/articles/pressure_linear_advance/introduction.html)

2.  **Multiple Data Sets (Multi-Pass)**:
    - If you ran the test multiple times (e.g., to verify results or test different filaments), click the **+ Add** button in any cell.
    - This adds a `PA2`, `PA3` field, etc.
    - You can enter up to 3 distinct values for the same coordinate. These will be treated as separate datasets in the visualizer.

### 3. Visualizing & Combining Data

After filling in your data:

1.  **Push to Visualizer**:

    - Click the **Push current table to visualizer** button (top right).
    - The app will switch to the 3D View.

2.  **Viewing Data**:

    - **Set 1, Set 2, Set 3**: Use the tabs at the top to toggle between your different data runs.
    - **3D Plot**: Rotate (Left Click), Pan (Right Click), and Zoom (Scroll) to inspect the surface.
    - **Analysis**: Use the visualizer to check for **outliers** (unusual spikes or drops) and compare datasets to see if there is significant variability between test runs.

3.  **Combining Datasets**:
    - Go to the **Combined** tab.
    - Click **Combine Datasets**.
    - Select which sets to merge (e.g., Set 1 + Set 2).
    - **Smoothing**: Enable "Use Weighted Smoothing".
    - **Lambda Slider**: Controls the strength of the smoothing.
      - **Lower Lambda**: Closer to the raw data (more detail, potentially more noise).
      - **Higher Lambda**: Smoother surface (less noise, more generalized trend).
    - This "Average Surface" gives you the most reliable calibration data derived from all your tests.
