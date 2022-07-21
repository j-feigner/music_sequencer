<?php
    $dir_name = $_GET["instr"];
    $dir_contents = scandir("../sounds/".$dir_name);
    array_shift($dir_contents);
    array_shift($dir_contents);
    echo json_encode($dir_contents);
?>