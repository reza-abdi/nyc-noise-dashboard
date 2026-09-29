import matplotlib.pyplot as plt
import pandas as pd
import requests
import pandas as pd
import json

def SODA2_API_NYCDATA(api_url, params):
    """
    return pandas df from NYC Open Data SODA 2 API call
    
    NYC Open Data API is SODA - Socrata Open Data 
    using the .json extension is easiest
    wrapped in a try-except block for error detection 
    """


    try:
        response = requests.get(api_url, params=params)
        #will raise an HTTPError if the HTTP request returned an unsuccessful status code
        response.raise_for_status()

        #load result data into a pandas df object
        #the JSON response can be directly placed in a df 
        data = response.json()
        df = pd.DataFrame(data)
        
        print(f"Successfully fetched {len(df)} records from the NYC SODA 2 API with data size {df.shape}.")
        
        # #DATA PREVIEW 
        # print("\nDimensions of the dataset:")
        # print(df.shape)
        # #first 5 rows of the dataset
        # print("\nFirst 5 rows of the dataset:")
        # print(df.head())

        # #summary of the df
        # print("\nDataFrame Info:")
        # df.info()

    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error occurred: {http_err}")
    except Exception as err:
        print(f"An error occurred: {err}")

    return df



def remove_rows_with_na(df, columns_to_check=['issuedworkstartdate', 'issuedworkenddate','wkt']):
    """
    Remove rows that have NaN/NA values in specified columns.
    
    Parameters:
    -----------
    df : pandas.DataFrame
        The input dataframe
    columns_to_check : list, optional
        List of column names to check for NA values.
        Default checks: 'issuedworkstartdate', 'issuedworkenddate','wkt'
    
    Returns:
    --------
    pandas.DataFrame
        Cleaned dataframe with rows containing NAs removed
    """
    
    # Check which columns actually exist in the dataframe
    existing_columns = [col for col in columns_to_check if col in df.columns]
    
    if not existing_columns:
        print(f"Warning: None of the specified columns exist in the dataframe")
        return df
    
    initial_rows = len(df)
    df_cleaned = df.dropna(subset=existing_columns)
    removed_rows = initial_rows - len(df_cleaned)
    
    print(f"Removed {removed_rows} rows with NA values ({removed_rows/initial_rows*100:.2f}%)")
    # print(f"Remaining rows: {len(df_cleaned)}")
    
    return df_cleaned


def convert_to_year_month(df, date_columns=None):
    """
    Convert datetime columns to year-month format (YYYY-MM), 
    removing day and time information.
    
    Parameters:
    -----------
    df : pandas.DataFrame
        The input dataframe
    date_columns : list, optional
        List of column names containing datetime information.
        Default: ['issuedworkstartdate', 'issuedworkenddate']
    
    Returns:
    --------
    pandas.DataFrame
        Dataframe with date columns converted to year-month format
    """
    import pandas as pd
    
    if date_columns is None:
        date_columns = ['issuedworkstartdate', 'issuedworkenddate']
    
    df_copy = df.copy()
    
    for col in date_columns:
        if col in df_copy.columns:
            # Convert to datetime if not already
            df_copy[col] = pd.to_datetime(df_copy[col], errors='coerce')
            # Extract year-month only and format as YYYY-MM
            df_copy[col] = df_copy[col].dt.strftime('%Y-%m')            
        else:
            print(f"Warning: Column '{col}' not found in dataframe")
    
    return df_copy

def clean_permit_data(df, check_columns = ['permitnumber','issuedworkstartdate', 'issuedworkenddate']):
    """
    Complete cleaning pipeline for Street Construction Permits data.
    Applies all cleaning steps in sequence.
    
    Parameters:
    -----------
    df : pandas.DataFrame
        Raw permit data
    check_columns: list, optional
        List of column names to check for NA values.
        Default checks: 'permitnumber','issuedworkstartdate', 'issuedworkenddate'
    
    Returns:
    --------
    pandas.DataFrame
        Cleaned dataframe
    """
    
    df_cleaned = remove_rows_with_na(df)
    
    df_cleaned = convert_to_year_month(df_cleaned)
    
    # Remove for duplicates
    df_cleaned = df_cleaned.drop_duplicates(subset=check_columns, keep='first')
        


    df_cleaned = df_cleaned.astype({'permitnumber': str,
                                    'permitteename': str,
                                    'boroughname': str})
    print(f"Cleaned dataset shape: {df_cleaned.shape}")

    return df_cleaned


def validate_cleaned_data(df):
    """
    Validate the cleaned data to ensure cleaning was successful.
    
    Parameters:
    -----------
    df : pandas.DataFrame
        Cleaned dataframe to validate
    
    Returns:
    --------
    dict
        Dictionary containing validation results
    """
    validation_results = {
        'total_rows': len(df),
        'total_columns': len(df.columns),
        'missing_values': df.isnull().sum().to_dict(),
        'date_columns_type': {}
    }
    
    # Check date column types
    for col in ['issuedworkstartdate', 'issuedworkenddate']:
        if col in df.columns:
            validation_results['date_columns_type'][col] = str(df[col].dtype)
    
    # print("\n" + "="*60)
    # print("Validation Results")
    # print(f"Total rows: {validation_results['total_rows']}")
    # print(f"Total columns: {validation_results['total_columns']}")
    # print(f"\n Missing values per column:")
    # for col, count in validation_results['missing_values'].items():
    #     if count > 0:
    #         print(f"  {col}: {count}")
    if sum(validation_results['missing_values'].values()) == 0:
        print("No missing values found")
    
    # print(f"\nDate column types:")
    # for col, dtype in validation_results['date_columns_type'].items():
    #     print(f"  {col}: {dtype}")
    
    return validation_results
