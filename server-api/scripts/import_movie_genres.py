#!/usr/bin/env python3
"""将 CSV 中的电影类型写入 movies.genres 字段。

CSV 示例：
genres,id,imdb_id
"[{'id': 12, 'name': 'Adventure'}, {'id': 16, 'name': 'Animation'}]",2,tt0094675
"""

import argparse
import ast
import csv
import json

import pymysql


def parse_genre_names(raw_genres: str):
  if not raw_genres:
    return []

  parsed = ast.literal_eval(raw_genres)
  if not isinstance(parsed, list):
    return []

  names = []
  for item in parsed:
    if isinstance(item, dict) and item.get('name'):
      names.append(str(item['name']).strip())

  return names


def ensure_genres_column(conn, database_name: str):
  with conn.cursor() as cursor:
    cursor.execute(
      """
      SELECT COUNT(*)
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = %s
        AND TABLE_NAME = 'movies'
        AND COLUMN_NAME = 'genres'
      """,
      (database_name,)
    )
    exists = cursor.fetchone()[0] > 0

    if not exists:
      cursor.execute('ALTER TABLE movies ADD COLUMN genres JSON NULL')
      conn.commit()
      print('已新增 movies.genres 字段')


def import_genres(conn, csv_path: str):
  updated = 0

  with open(csv_path, 'r', encoding='utf-8-sig', newline='') as f:
    reader = csv.DictReader(f)

    required_cols = {'genres', 'id', 'imdb_id'}
    if not required_cols.issubset(set(reader.fieldnames or [])):
      raise ValueError('CSV 必须包含 genres, id, imdb_id 三列')

    with conn.cursor() as cursor:
      for row in reader:
        movie_id = row.get('id')
        imdb_id = row.get('imdb_id')
        genre_names = parse_genre_names(row.get('genres', ''))

        if not movie_id and not imdb_id:
          continue

        genres_json = json.dumps(genre_names, ensure_ascii=False)

        cursor.execute(
          """
          UPDATE movies
          SET genres = %s
          WHERE id = %s OR imdb_id = %s
          """,
          (genres_json, movie_id, imdb_id)
        )
        updated += cursor.rowcount

  conn.commit()
  return updated


def main():
  parser = argparse.ArgumentParser(description='导入电影类型到 MySQL movies 表')
  parser.add_argument('--csv', required=True, help='CSV 文件路径')
  parser.add_argument('--host', default='localhost')
  parser.add_argument('--port', type=int, default=3306)
  parser.add_argument('--user', default='root')
  parser.add_argument('--password', default='123123lzy')
  parser.add_argument('--database', default='movie_db')
  args = parser.parse_args()

  conn = pymysql.connect(
    host=args.host,
    port=args.port,
    user=args.user,
    password=args.password,
    database=args.database,
    charset='utf8mb4'
  )

  try:
    ensure_genres_column(conn, args.database)
    updated_count = import_genres(conn, args.csv)
    print(f'导入完成，更新行数: {updated_count}')
  finally:
    conn.close()


if __name__ == '__main__':
  main()
