import geopandas as gpd
import pandas as pd
import numpy as np
from shapely import wkt
from shapely.geometry import Point, LineString
import matplotlib.pyplot as plt
import os
import json
import requests
import warnings
from shapely.errors import ShapelyDeprecationWarning

# Borough ID mapping
BOROUGH_IDS = {
    'MANHATTAN': 1,
    'BRONX': 2,
    'BROOKLYN': 3,
    'QUEENS': 4,
    'STATEN ISLAND': 5
}

def get_borough_id(borough_name):
    """
    Get borough ID from borough name.
    
    Parameters:
    -----------
    borough_name : str
        Borough name string
        
    Returns:
    --------
    int or None
        Borough ID (1-5), or None if not found
    """
    if pd.isna(borough_name):
        return None
    
    borough_upper = str(borough_name).strip().upper()
    return BOROUGH_IDS.get(borough_upper)


def extract_borough_from_cd(cd):
    """
    Extract borough ID from community district code.
    
    Parameters:
    -----------
    cd : int
        Community district code (e.g., 101, 205)
        
    Returns:
    --------
    int
        Borough ID (1-5)
    """
    return int(cd) // 100


def download_cd_geodata(cache_file='data/NYC_DCP_GeoJSON.geojson'):
    """
    Download NYC Community Districts GeoJSON data from NYC OpenData API.

    Source: https://www.nyc.gov/content/planning/pages/resources/datasets/community-districts

    Parameters:
    -----------
    None

    Returns:
    --------
    geopandas.GeoDataFrame
        Community district boundaries in EPSG:2263 coordinate system with exploded geometries

    Notes:
    ------
    Uses "Water Included" version to avoid gaps in shoreline coverage that could result in 
    unassigned community districts. Caches results locally, converts to EPSG:2263, validates 
    geometries, and explodes MultiPolygons to Polygons.

    Available datasets:
    1. Community Districts (Clipped to Shoreline)
    https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/NYC_Community_Districts/FeatureServer/0/query?where=1=1&outFields=*&outSR=4326&f=pgeojson

    2. Community Districts (Water Included) - USED
    https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/NYC_Community_Districts_Water_Included/FeatureServer/0/query?where=1=1&outFields=*&outSR=4326&f=pgeojson
    """

    if os.path.exists(cache_file):
        print(f"Loading cached community district data from {cache_file}...")
        try:
            cd_gdf = gpd.read_file(cache_file)
        except Exception as e:
            print(f"Error reading cache file {cache_file}: {e}. Attempting re-download.")
            os.remove(cache_file)
            return download_cd_geodata(cache_file)
    else:
        print("Downloading NYC Community Districts GeoJSON from API...")
        url = "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/NYC_Community_Districts_Water_Included/FeatureServer/0/query?where=1=1&outFields=*&outSR=4326&f=pgeojson"
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            geojson_data = response.json()
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to download data: {e}")
        except json.JSONDecodeError:
             raise Exception(f"Failed to decode JSON from API response.")

        with open(cache_file, 'w') as f:
            json.dump(geojson_data, f)
        cd_gdf = gpd.read_file(cache_file)
        print(f"Downloaded and cached {len(cd_gdf)} community districts features")

    target_crs = 'EPSG:2263'
    if str(cd_gdf.crs).upper() != target_crs:
        print(f"Converting boundaries from {cd_gdf.crs} to {target_crs} (NY Long Island State Plane)...")
        try:
            cd_gdf = cd_gdf.to_crs(target_crs)
        except Exception as e:
            raise Exception(f"CRS conversion failed: {e}. Check if pyproj is installed correctly.")
    else:
         print(f"Boundaries already in target CRS: {target_crs}")

    # Validation and Cleaning 
    cd_gdf['geometry'] = cd_gdf.geometry.buffer(0)
    initial_geom_count = len(cd_gdf)
    cd_gdf = cd_gdf[~cd_gdf.is_empty]
    cd_gdf = cd_gdf[cd_gdf.is_valid]
    cleaned_geom_count = len(cd_gdf)
    if cleaned_geom_count < initial_geom_count:
        print(f"Removed {initial_geom_count - cleaned_geom_count} invalid/empty geometries from CD data.")
    if cd_gdf.empty:
        raise Exception("All community district geometries became invalid after buffering.")
    if 'BoroCD' not in cd_gdf.columns:
         raise ValueError("'BoroCD' column not found in GeoDataFrame. Check GeoJSON source.")
    try:
        cd_gdf['BoroCD'] = pd.to_numeric(cd_gdf['BoroCD'], errors='coerce')
        cd_gdf.dropna(subset=['BoroCD'], inplace=True)
        cd_gdf['BoroCD'] = cd_gdf['BoroCD'].astype(int)
    except Exception as e:
        print(f"Warning: Could not reliably convert 'BoroCD' to integer: {e}")


    # Explode MultiPolygons into individual Polygons to simplify intersection logic and CD assignment
    original_feature_count = len(cd_gdf)
    contains_multi = any(cd_gdf.geometry.type == 'MultiPolygon')
    if contains_multi:
        cd_gdf_exploded = cd_gdf.explode(index_parts=False).reset_index(drop=True)
        cd_gdf_exploded['geometry'] = cd_gdf_exploded.geometry.buffer(0)
        cd_gdf_exploded = cd_gdf_exploded[cd_gdf_exploded.geometry.type == 'Polygon']
        cd_gdf_exploded = cd_gdf_exploded[~cd_gdf_exploded.is_empty].reset_index(drop=True)
        print(f"Original CD features: {original_feature_count}, Exploded to: {len(cd_gdf_exploded)} simple Polygons")
        if cd_gdf_exploded.empty:
            raise Exception("All community district geometries invalid after exploding/buffering.")
        cd_gdf_exploded['BoroCD'] = cd_gdf_exploded['BoroCD'].astype(int)
        return cd_gdf_exploded
    else:
        print("No MultiPolygons found to explode.")
        cd_gdf = cd_gdf[cd_gdf.geometry.type == 'Polygon'].reset_index(drop=True)
        cd_gdf['BoroCD'] = cd_gdf['BoroCD'].astype(int)
        return cd_gdf
