<?php
    $dir_name = $_GET["dir"];
    $dir_contents = scandir($dir_name);
    array_shift($dir_contents);
    array_shift($dir_contents);
    echo json_encode($dir_contents);
?>