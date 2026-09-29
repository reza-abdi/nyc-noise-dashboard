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



def plot_stacked_bar(df, year_col, category_col, title, top_n=5, 
                     label_map=None, color_map=None, figsize=(14, 8)):
    """
    Create a stacked bar chart showing year-over-year breakdown by category.
    
    Parameters:
    -----------
    df : DataFrame
        Input dataframe
    year_col : str
        Column name containing year data (will extract year only)
    category_col : str
        Column name for categories to stack (e.g., 'permittypeid' or 'primary_cd')
    title : str
        Chart title
    top_n : int
        Number of top categories to show (default: 5). Others grouped as 'Other'
    label_map : dict, optional
        Dictionary mapping category IDs to readable names for legend
    color_map : list, optional
        List of colors for mapping categories
    figsize : tuple
        Figure size (width, height)
    """
    
    df_plot = df.copy()
    
    # Extract year only from year_col
    df_plot['year_only'] = pd.to_datetime(df_plot[year_col]).dt.year
    
    # Get top N categories by total count
    top_categories = df_plot[category_col].value_counts().head(top_n).index.tolist()
    
    # Create grouped category column
    df_plot['category_grouped'] = df_plot[category_col].apply(
        lambda x: x if x in top_categories else 'Others'
    )
    
    # Group and pivot for stacked bar
    grouped = df_plot.groupby(['year_only', 'category_grouped']).size().unstack(fill_value=0)
    
    # Reorder columns: top categories first, then 'Others'
    if 'Others' in grouped.columns:
        cols_order = [c for c in top_categories if c in grouped.columns] + ['Others']
    else:
        cols_order = [c for c in top_categories if c in grouped.columns]
    grouped = grouped[cols_order]
    
    # Apply label mapping to column names if provided
    if label_map:
        grouped.columns = [label_map.get(col, col) for col in grouped.columns]
    
    # Create figure
    fig, ax = plt.subplots(figsize=figsize)
    
    # Generate colors
    if color_map is None:
        colors = plt.cm.tab10(range(len(grouped.columns)))
    else:
        colors = color_map
    
    # Create stacked bar chart
    grouped.plot(kind='bar', stacked=True, ax=ax, color=colors, 
                 edgecolor='white', linewidth=0.5)
    
    # Styling
    ax.set_title(title, fontsize=16, fontweight='bold', pad=20)
    ax.set_xlabel('Year', fontsize=12)
    ax.set_ylabel('Count', fontsize=12)
    ax.legend(title=f'Top {top_n} {category_col}', bbox_to_anchor=(1.05, 1), 
              loc='upper left', fontsize=9)
    ax.grid(axis='y', linestyle='--', alpha=0.6)
    ax.set_xticklabels(grouped.index, rotation=45, ha='right')
    
    plt.tight_layout()
    return fig, ax
