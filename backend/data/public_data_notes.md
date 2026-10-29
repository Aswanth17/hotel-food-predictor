# Dataset Sources, Field Mapping, and Limitations

This document provides a transparent and rigorous breakdown of historical data sources, column compatibility, mapping rules, and the distinction between real public benchmark datasets and our synthetic hotel operational dataset.

---

## 1. Why a Hotel-Specific Dataset is Essential

Commercial hotel food & beverage (F&B) operations operate under structural constraints distinct from general restaurants or meal delivery companies:
1. **Buffet & Package Dynamics**: In hotels, breakfast is frequently bundled with room occupancy (European/Bed & Breakfast plan), leading to high turnout ratios (~85–95% of in-house guests). Lunch and dinner turnouts fluctuate based on business conferences, leisure outings, and room service.
2. **Bulk Preparation Units**: Commercial hotel provisioning calculates raw ingredients and prepared dishes in physical culinary units (**kg** for grains, meats, gravies, salads; **litres** for milk, juices, soups, coffee; **pieces** for bakery croissants, dinner rolls, cutlets, desserts).
3. **Overproduction & Waste Management**: Hotels prepare a planned buffer (typically 4–8%) above anticipated guest consumption to prevent buffet run-outs while minimizing kitchen waste and spoilage.

---

## 2. Public Benchmark Datasets Examined

When inspecting available public datasets in the hospitality and food-demand domains, two prominent public benchmarks were analyzed for integration:

### A. Hotel Booking Demand Dataset (Antonio, de Almeida, and Nunes, 2019)
- **Source**: Kaggle / Data in Brief journal (Lisbon City Hotel & Algarve Resort Hotel).
- **Available Fields**: `hotel` (City/Resort), `is_canceled`, `lead_time`, `arrival_date_year`, `arrival_date_month`, `arrival_date_week_number`, `arrival_date_day_of_month`, `stays_in_weekend_nights`, `stays_in_week_nights`, `adults`, `children`, `babies`, `meal` (Undefined/SC/BB/HB/FB), `country`, `market_segment`, `adr` (Average Daily Rate).
- **Compatible Mappings**:
  - `hotel` $\rightarrow$ Hotel name / type identifier.
  - `arrival_date_*` $\rightarrow$ Calendar date, month, day of week, season.
  - `adults + children` $\rightarrow$ In-house visitor / guest head count.
  - `meal` $\rightarrow$ Session plan (BB = Bed & Breakfast, HB = Half Board/Dinner, FB = Full Board).
- **Critical Limitation**: This dataset **does not track food items or kitchen consumption quantities (kg, L, pieces)**. It only records booking transactions. It cannot train food-level ingredient regression models directly without synthetic consumption augmentation.

### B. Food Demand Forecasting Challenge Dataset (Analytics Vidhya / Kaggle)
- **Source**: Meal delivery center order fulfilment records across multiple cities.
- **Available Fields**: `week`, `center_id`, `meal_id`, `checkout_price`, `base_price`, `emailer_for_promotion`, `homepage_featured`, `num_orders`.
- **Compatible Mappings**:
  - `meal_id` $\rightarrow$ Food item identifier.
  - `center_id` $\rightarrow$ Operational node (proxy for hotel branch).
  - `num_orders` $\rightarrow$ Demand volume count.
- **Critical Limitation**: `num_orders` represents individual delivery order packaging units, **not guest headcounts or physical mass (kilograms / litres)**. Claiming that restaurant meal delivery orders equal hotel dining room guest counts or that numbers represent kilograms would be statistically invalid.

---

## 3. The Synthetic Demonstration Dataset

To satisfy real hotel operational requirements without fabricating or distorting public datasets, the application includes a **clearly labelled synthetic demonstration dataset**:
- **Dataset Label**: `synthetic_demonstration` (explicitly stored in every database record and CSV export).
- **Hotels**: 5 distinct operational profiles (5-star luxury metro palace, coastal beachfront resort, heritage mountain inn, financial district business hotel, airport convention center).
- **Catalogue**: 16 standard commercial hotel buffet items across 7 categories (`Bakery`, `Main Course`, `Beverage`, `Dairy`, `Breakfast Special`, `Salad`, `Dessert`).
- **Units**: Strictly enforced per item (`kg`, `litres`, `pieces`). Never cross-contaminated.
- **Realistic Variance**: Guest counts reflect hotel dining capacity, seasonal shifts, day-of-week patterns (resorts surge on weekends; business hotels surge mid-week), and meal sessions. Food consumption correlates with actual guest count scaled by standard per-guest consumption factors ($\pm 8\%$ natural stochastic variance).

---

## 4. Column Mapping Specification for User CSV Upload

When uploading custom CSV files, the backend accepts the following standardized schema:

| Column Name | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `hotel_name` | String | Yes | Name of hotel (matches existing or creates new) | "The Grand Horizon Palace" |
| `record_date` | Date | Yes | Format `YYYY-MM-DD` | "2026-10-15" |
| `meal_type` | String | Yes | Must be `Breakfast`, `Lunch`, or `Dinner` | "Breakfast" |
| `food_item_name` | String | Yes | Name of food item | "Fresh Butter Croissants" |
| `actual_guest_count` | Integer | Yes | Count of guests served ($\ge 0$) | 145 |
| `actual_quantity_consumed` | Float | Yes | Amount consumed in specified unit ($\ge 0$) | 203.0 |
| `unit` | String | Yes | Must match `kg`, `litres`, or `pieces` | "pieces" |
| `actual_quantity_prepared` | Float | No | Total prepared quantity | 215.0 |
| `waste_quantity` | Float | No | Quantity unconsumed/discarded | 12.0 |
| `occupancy_rate` | Float | No | Room occupancy decimal (0.0 to 1.0) | 0.82 |
| `is_weekend` | Integer | No | 1 for Fri/Sat/Sun, 0 for Mon-Thu | 0 |
| `is_holiday_or_event` | Integer | No | 1 if festival/banquet/holiday | 0 |
| `season` | String | No | Winter, Spring, Summer, Autumn | "Autumn" |

---

## 5. Duplicate Detection & Deduplication Strategy

When importing or previewing CSV data:
1. **Composite Key**: `(hotel_id, record_date, meal_type, food_item_id)`.
2. **Detection Logic**: If an incoming record matches an existing record on this composite key, it is flagged as a potential duplicate.
3. **User-Controlled Import Options**:
   - **Skip Duplicates (Default)**: Keeps the existing historical record and skips incoming duplicates, logging skipped rows in the import report.
   - **Update / Overwrite**: Updates the existing record with the newer uploaded figures.
   - **Keep Both / Archive**: Records conflict with audit timestamp.
4. **Integrity Guarantee**: Duplicate detection never silently discards records; every row is accounted for in the API import summary response.
