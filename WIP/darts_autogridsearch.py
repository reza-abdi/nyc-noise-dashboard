#############################################################
########## Original Code Block are commented below ##########
######## Construction Permit Counts as Covariate ############
#############################################################

# factor_forecasts_active_work_counts = []
# time_index = pd.period_range(start='2014-01', end='2025-12', freq='M')
# future_covariate= TimeSeries.from_times_and_values(time_index.to_timestamp(), monthly_active_work_counts_grouped_array.reshape(-1,1)) #2012-2025
# for r in range(4):
#     model = AutoETS( season_length=12)
#     series = TimeSeries.from_times_and_values(time_index[:-36].to_timestamp(), time_array[:, r].reshape(-1,1)) #2012-2022
#     model.fit(series, future_covariates = future_covariate[:-36]) #Future covariates up to end of 2022
#     forecast = model.predict(24, future_covariates = future_covariate) #predict 2023-2025, provide future covariates from end of series to end of forecast so 2023-2025
#     factor_forecasts_active_work_counts.append(forecast)
#     plt.figure(figsize=(10, 4))
#     plt.plot(np.arange(len(time_array[:, r])), time_array[:, r], label='Original', marker='o')
#     plt.plot(np.arange(len(time_array[:, r]), len(time_array[:, r]) + 24),
#                 forecast.values(), label='Forecast', marker='o', color='red')
#     plt.title(f'Forecasting time_array Factor for Component {r+1} with Active Work Counts as Covariate')
#     plt.xlabel('time_array (Months)')
#     plt.ylabel('Factor Value')
#     plt.legend()
#     plt.grid(True)
#     plt.show()

# #calculate RMSE on 2023-2024 using active work counts adjusted forecasts, recall it's list of TimeSeries
# factor_forecasts_active_work_counts = np.array([fc.values().flatten() for fc in factor_forecasts_active_work_counts]).T

# extended_time_factor = np.vstack([time_array, factor_forecasts_active_work_counts])
# extended_factors = [tl.tensor(extended_time_factor), complaint_types, community_boards]
# extended_reconstructed_tensor = cp_to_tensor((weights, extended_factors))
# test_tensor = test_df.pivot_table(index='Year_Month', columns=['Complaint Type', 'Community Board'], values='count', fill_value=0).values
# test_tensor = test_tensor.reshape((test_tensor.shape[0], len(all_complaint_types), len(all_community_boards)))


# estimate_time_tensor=extended_reconstructed_tensor[108:,:,:].flatten()
# mse = mean_squared_error(test_tensor.flatten(), estimate_time_tensor)
# rmse = np.sqrt(mse)

# print(f'Mean Squared Error on Test Set: {mse}')
# print(f'Root Mean Squared Error on Test Set: {rmse}')


# =============================================================================================================================
#############################################################
########## Dart's Gridsearch Method for AutoETS #############
######## Construction Permit Counts as Covariate ############
#############################################################


from darts.metrics import mse, rmse

factor_forecasts_active_work_counts = []
time_index = pd.period_range(start='2014-01', end='2025-12', freq='M')
future_covariate = TimeSeries.from_times_and_values(
    time_index.to_timestamp(), 
    monthly_active_work_counts_grouped_array.reshape(-1, 1)
)  # 2014-2025

for r in range(4):
    series = TimeSeries.from_times_and_values(
        time_index[:-36].to_timestamp(), 
        time_array[:, r].reshape(-1, 1)
    )  # 2014-2022
    
    # Grid search for best season_length using expanding window
    parameters = {'season_length': [3, 6, 9, 12]}
    
    best_model, best_params, best_score = AutoETS.gridsearch(
        parameters=parameters,
        series=series,  # Full training data 2014-2022
        future_covariates=future_covariate[:-36],  # Covariates 2014-2022
        forecast_horizon=12,  # Predict 12 months ahead at each step
        stride=12,  # Move 12 months forward between predictions
        metric=mse
    )
    
    print(f"\nRank {r+1}:")
    print(f"Best season_length: {best_params['season_length']}")
    
    # Train final model on full data with best parameters
    final_model = AutoETS(season_length=best_params['season_length'])
    final_model.fit(series, future_covariates=future_covariate[:-36])
    
    # Predict 2023-2025
    forecast = final_model.predict(24, future_covariates=future_covariate)
    factor_forecasts_active_work_counts.append(forecast)
    
    # Plotting
    plt.figure(figsize=(10, 4))
    plt.plot(np.arange(len(time_array[:, r])), time_array[:, r], 
             label='Original', marker='o')
    plt.plot(np.arange(len(time_array[:, r]), len(time_array[:, r]) + 24),
             forecast.values(), label='Forecast', marker='o', color='red')
    plt.title(f'Forecasting time_array Factor for Component {r+1} with Active Work Counts as Covariate')
    plt.xlabel('time_array (Months)')
    plt.ylabel('Factor Value')
    plt.legend()
    plt.grid(True)
    plt.show()


#calculate RMSE on 2023-2024 using active work counts adjusted forecasts, recall it's list of TimeSeries
factor_forecasts_active_work_counts = np.array([fc.values().flatten() for fc in factor_forecasts_active_work_counts]).T

extended_time_factor = np.vstack([time_array, factor_forecasts_active_work_counts])
extended_factors = [tl.tensor(extended_time_factor), complaint_types, community_boards]
extended_reconstructed_tensor = cp_to_tensor((weights, extended_factors))
test_tensor = test_df.pivot_table(index='Year_Month', columns=['Complaint Type', 'Community Board'], values='count', fill_value=0).values
test_tensor = test_tensor.reshape((test_tensor.shape[0], len(all_complaint_types), len(all_community_boards)))


estimate_time_tensor=extended_reconstructed_tensor[108:,:,:].flatten()
mse = mean_squared_error(test_tensor.flatten(), estimate_time_tensor)
rmse = np.sqrt(mse)

print(f'Mean Squared Error on Test Set: {mse}')
print(f'Root Mean Squared Error on Test Set: {rmse}')

# =============================================================================================================================
