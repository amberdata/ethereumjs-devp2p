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
# this part does not seem to work
# [ -z "${DATABASE_HOSTNAME}" ] && declare DATABASE_HOSTNAME="127.0.0.1"
# [ -z "${DATABASE_PORT}"     ] && declare DATABASE_PORT="5432"
# [ -z "${DATABASE_DATABASE}" ] && declare DATABASE_DATABASE="ethereum"
# [ -z "${DATABASE_USERNAME}" ] && declare DATABASE_USERNAME="pwang"
# [ -z "${DATABASE_PASSWORD}" ] && declare DATABASE_PASSWORD=">MwoYREUZIE%z@!["
#
# [ -z "${INSTANCE_ID}"     ] && declare INSTANCE_ID="1"
# [ -z "${TOTAL_INSTANCE_COUNT}"     ] && declare TOTAL_INSTANCE_COUNT="3"
#
# DATABASE_HOSTNAME="${DATABASE_HOSTNAME}" \
# DATABASE_PORT="${DATABASE_PORT}"         \
# DATABASE_DATABASE="${DATABASE_DATABASE}" \
# DATABASE_USERNAME="${DATABASE_USERNAME}" \
# DATABASE_PASSWORD="${DATABASE_PASSWORD}" \
# INSTANCE_ID="${INSTANCE_ID}"         \
# TOTAL_INSTANCE_COUNT="${TOTAL_INSTANCE_COUNT}"         \

export DATABASE_HOSTNAME="127.0.0.1"
export DATABASE_PORT="5432"
export DATABASE_DATABASE="ethereum"
export DATABASE_USERNAME="admin"
export DATABASE_PASSWORD="admin"

while true
do
	kill $(ps aux | grep 'examples/simple.js' | awk '{print $2}')
	nohup node -r babel-register examples/simple.js >>examples/simple.log &
	sleep 180
done
echo 'end'
