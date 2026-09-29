def calculate_monthly_active_work_counts(df):
    """
    Calculate monthly active work counts by community district.
    
    Parameters:
    -----------
    df : pandas DataFrame
        Input dataframe with permit information.
        Expects 'issuedworkstartdate' and 'issuedworkenddate' in 'YYYY-MM' format.
        
    Returns:
    --------
    pandas DataFrame
        Output with 'date' column in 'YYYY-MM' format and community districts as columns
    """
    import pandas as pd
    import ast

    # Make a copy to avoid modifying original
    df = df.copy()
    
    # Convert month-year strings to Period objects
    df['issuedworkstartdate'] = pd.to_datetime(df['issuedworkstartdate'], format='%Y-%m', errors='coerce').dt.to_period('M')
    df['issuedworkenddate'] = pd.to_datetime(df['issuedworkenddate'], format='%Y-%m', errors='coerce').dt.to_period('M')
    
    # Remove rows with invalid dates
    df = df.dropna(subset=['issuedworkstartdate', 'issuedworkenddate'])
    
    # Find the overall month range
    min_month = df['issuedworkstartdate'].min()
    max_month = df['issuedworkenddate'].max()
    
    # Create month range
    month_range = pd.period_range(start=min_month, end=max_month, freq='M')
    
    # Initialize result dictionary
    month_counts = {month: {} for month in month_range}
    
    # Process each permit
    for idx, row in df.iterrows():
        start_month = row['issuedworkstartdate']
        end_month = row['issuedworkenddate']
        cd_props = row['cd_wkt_dict']
        
        # Parse cd_proportions if it's a string
        if isinstance(cd_props, str):
            try:
                cd_props = ast.literal_eval(cd_props)
            except:
                cd_props = {}
        elif pd.isna(cd_props) or not isinstance(cd_props, dict):
            cd_props = {}
        
        # Generate all months in the work window (inclusive)
        work_months = pd.period_range(start=start_month, end=end_month, freq='M')
        
        # If no community districts, assign to 'Unknown'
        if not cd_props or len(cd_props) == 0:
            for month in work_months:
                if month not in month_counts:
                    continue
                if 'Unknown' not in month_counts[month]:
                    month_counts[month]['Unknown'] = 0
                month_counts[month]['Unknown'] += 1
        else:
            # Distribute the count across community districts by proportion
            for cd, proportion in cd_props.items():
                cd_name = f'{cd}'
                for month in work_months:
                    if month not in month_counts:
                        continue
                    if cd_name not in month_counts[month]:
                        month_counts[month][cd_name] = 0
                    month_counts[month][cd_name] += proportion
    
    # Convert to DataFrame
    result_df = pd.DataFrame.from_dict(month_counts, orient='index')
    
    # Fill NaN values with 0
    result_df = result_df.fillna(0)
    
    # Sort columns alphabetically, but put Unknown at the end if it exists
    cols = sorted([col for col in result_df.columns if col != 'Unknown'])
    if 'Unknown' in result_df.columns:
        cols.append('Unknown')
    result_df = result_df[cols]
    
    # Reset index and rename to 'date'
    result_df.index.name = 'date'
    result_df = result_df.reset_index()
        
    return result_df


def calculate_monthly_average_linearfeet(df):
    """
    Calculate monthly average permit linear feet by community district.
    
    Parameters:
    -----------
    df : pandas DataFrame
        Input dataframe with permit information.
        Expects 'issuedworkstartdate' and 'issuedworkenddate' in 'YYYY-MM' format.
        
    Returns:
    --------
    pandas DataFrame
        Output with 'date' column in 'YYYY-MM' format and community districts as columns
    """
    
    # Make a copy to avoid modifying original
    import pandas as pd
    import ast
        
    df = df.copy()
    
    # Convert month-year strings to Period objects
    df['issuedworkstartdate'] = pd.to_datetime(df['issuedworkstartdate'], format='%Y-%m', errors='coerce').dt.to_period('M')
    df['issuedworkenddate'] = pd.to_datetime(df['issuedworkenddate'], format='%Y-%m', errors='coerce').dt.to_period('M')
    
    # Remove rows with invalid dates
    df = df.dropna(subset=['issuedworkstartdate', 'issuedworkenddate'])
    
    # Find the overall month range
    min_month = df['issuedworkstartdate'].min()
    max_month = df['issuedworkenddate'].max()
    
    # Create month range
    month_range = pd.period_range(start=min_month, end=max_month, freq='M')
    
    # Initialize result dictionaries: one for sum, one for count
    monthly_sum = {month: {} for month in month_range}
    monthly_count = {month: {} for month in month_range}
    
    # Process each permit
    for idx, row in df.iterrows():
        start_month = row['issuedworkstartdate']
        end_month = row['issuedworkenddate']
        cd_props = row['cd_wkt_dict']
        distance = row['est_distance']
        
        # Skip if no valid distance
        if pd.isna(distance):
            continue
        
        # Parse cd_proportions if it's a string
        if isinstance(cd_props, str):
            try:
                cd_props = ast.literal_eval(cd_props)
            except:
                cd_props = {}
        elif pd.isna(cd_props) or not isinstance(cd_props, dict):
            cd_props = {}
        
        # Generate all months in the work window (inclusive)
        work_months = pd.period_range(start=start_month, end=end_month, freq='M')
        
        # If no community districts, assign to 'Unknown'
        if not cd_props or len(cd_props) == 0:
            for month in work_months:
                if month not in monthly_sum:
                    continue
                if 'Unknown' not in monthly_sum[month]:
                    monthly_sum[month]['Unknown'] = 0
                    monthly_count[month]['Unknown'] = 0
                monthly_sum[month]['Unknown'] += distance
                monthly_count[month]['Unknown'] += 1
        else:
            # For each community district, add the distance
            for cd, proportion in cd_props.items():
                cd_name = f'{cd}'
                for month in work_months:
                    if month not in monthly_sum:
                        continue
                    if cd_name not in monthly_sum[month]:
                        monthly_sum[month][cd_name] = 0
                        monthly_count[month][cd_name] = 0
                    # Add proportional distance to sum
                    monthly_sum[month][cd_name] += distance * proportion
                    # Add proportional count
                    monthly_count[month][cd_name] += proportion
    
    # Calculate averages
    monthly_avg = {}
    for month in month_range:
        monthly_avg[month] = {}
        for cd in monthly_sum[month].keys():
            if monthly_count[month][cd] > 0:
                monthly_avg[month][cd] = monthly_sum[month][cd] / monthly_count[month][cd]
            else:
                monthly_avg[month][cd] = 0
    
    # Convert to DataFrame
    result_df = pd.DataFrame.from_dict(monthly_avg, orient='index')
    
    # Fill NaN values with 0
    result_df = result_df.fillna(0)
    
    # Sort columns alphabetically, but put Unknown at the end if it exists
    cols = sorted([col for col in result_df.columns if col != 'Unknown'])
    if 'Unknown' in result_df.columns:
        cols.append('Unknown')
    result_df = result_df[cols]
    
    # Reset index and rename to 'date'
    result_df.index.name = 'date'
    result_df = result_df.reset_index()
    
    return result_df