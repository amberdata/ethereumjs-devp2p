########################################################################################################################
#
# Copyright © 2017 Amberdata, Inc.
# California, USA
# All rights reserved.  Confidential and Proprietary.
#
# This software (the "Software") is provided pursuant to the license agreement you entered into with Amberdata,
# Inc. (the "License Agreement").  The Software is the confidential and proprietary information of Amberdata,
# Inc., and you shall use it only in accordance with the terms and conditions of the License Agreement.
#
# THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE."  AMBERDATA, INC. MAKES NO WARRANTIES OF ANY KIND, WHETHER
# EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO THE IMPLIED WARRANTIES AND CONDITIONS OF MERCHANTABILITY, FITNESS
# FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT.
#
########################################################################################################################

#!/usr/bin/env bash
echo 'start'
while true
do
	kill $(ps aux | grep 'examples/simple.js' | awk '{print $2}')
	nohup node -r babel-register examples/simple.js >examples/simple.log &
	sleep 60
done
echo 'end'