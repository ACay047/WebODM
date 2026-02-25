import os
import time
import shutil
import struct
import tempfile

import numpy as np
from PIL import Image
from django.contrib.auth.models import User
from guardian.shortcuts import assign_perm, remove_perm
from rest_framework import status
from rest_framework.test import APIClient

import worker
from app.models import Project
from app.models import Task
from app.tests.classes import BootTransactionTestCase
from app.tests.utils import clear_test_media_root
from nodeodm import status_codes
from webodm import settings


TEST_RSULTS_DIR = os.path.join(
    os.path.dirname(os.path.realpath(__file__)),
    "..", "..", "nodeodm", "external", "NodeODM", "tests", "processing_results"
)

def orthophoto_path():
    return os.path.join(TEST_RSULTS_DIR, "odm_orthophoto", "odm_orthophoto.tif")

def dsm_path():
    return os.path.join(TEST_RSULTS_DIR, "odm_dem", "dsm.tif")

def dtm_path():
    return os.path.join(TEST_RSULTS_DIR, "odm_dem", "dtm.tif")

def laz_path():
    return os.path.join(TEST_RSULTS_DIR, "odm_georeferencing", "odm_georeferenced_model.laz")

def glb_path():
    return os.path.join(TEST_RSULTS_DIR, "odm_texturing", "odm_textured_model_geo.glb")


class TestApiTaskExternalImport(BootTransactionTestCase):
    def setUp(self):
        super().setUp()
        clear_test_media_root()


    def test_external_task_import(self):
        client = APIClient()
        client.login(username="testuser", password="test1234")

        user = User.objects.get(username="testuser")
        another_user = User.objects.get(username="testuser2")
        self.assertFalse(user.is_superuser)

        project = Project.objects.create(
            owner=user,
            name="test external import"
        )
        another_project = Project.objects.create(
            owner=user,
            name="another project"
        )

        # Test endpoint security
        res = client.post("/api/projects/{}/tasks/import/external/init".format(another_project.id))
        self.assertTrue(res.status_code, status.HTTP_404_NOT_FOUND)
        res = client.post("/api/projects/{}/tasks/import/external/upload".format(another_project.id))
        self.assertTrue(res.status_code, status.HTTP_404_NOT_FOUND)
        res = client.post("/api/projects/{}/tasks/import/external/commit".format(another_project.id))
        self.assertTrue(res.status_code, status.HTTP_404_NOT_FOUND)

        # Import with file upload method
        assets = {
            'orthophoto': orthophoto_path(),
            'dsm': dsm_path(),
            'dtm': dtm_path(),
            'pointcloud': pointcloud_path(),
            'texturedmodel': glb_path(),
        }
        for asset_type in assets:
            asset_file = assets[asset_type]
            upload_file = open(asset_file, 'rb')

            res = client.post("/api/projects/{}/tasks/import/external/init".format(project.id))
            self.assertTrue(res.status_code, status.HTTP_200_OK)
            self.assertTrue(isinstance(res.data['uuid'], str))

            # res = client.post("/api/projects/{}/tasks/import".format(project.id), {
            #     asset_type: [upload_file]
            # }, format="multipart")
            # self.assertEqual(res.status_code, status.HTTP_201_CREATED)
            # assets_file.close()