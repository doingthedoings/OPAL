# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1-rc3] - 2025-12-06

### Fixed

- **Pattern Generation**: Round speed values to integers (0 decimal places) to prevent floating-point errors (e.g., repeating decimals) that caused pattern generation failures.

### Changed

- **Config**: Allowed manual editing of **Layer Height** and **Line Width** in the Data Collection tab, with a warning that these values must match the slicer process settings.

## [1.0.1-rc2] - 2025-12-06

### Added

- **Multi-Dataset Support**: Logic to handle and visualize multiple datasets simultaneously.
- **Surface Combination**: Feature to combine/average multiple datasets into a single "Combined" dataset.
- **Weighted Smoothing**: RBF-based smoothing algorithm with adjustable Lambda slider to filter noise from combined data.
- **Visualizer Enhancements**:
  - New toolbar for combination and smoothing controls.
  - Multi-surface visibility toggles in the sidebar.
  - Color-coded datasets (Blue, Red, Emerald, Purple).
- **Documentation**:
  - Significant rewrite of `README.md` into a tutorial format.
  - Added new screenshots for visualization, batching, and combination features.
  - Added "Development & Cross-Platform Usage" guide.
