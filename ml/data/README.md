# Training data

Place the aligned probe/satellite dataset at
`data/soil_moisture_training_data.csv`. Data files are ignored by Git because
they can contain farm locations and grow quickly.

Required columns are documented in `training_schema.csv`. `farm_id` and
`observed_at` are not model inputs, but retaining them is important: `farm_id`
allows validation to hold out entire farms and avoid leakage.

Do not train a production artifact from invented rows. Each target must be a
probe measurement aligned to the satellite and weather observation time.
